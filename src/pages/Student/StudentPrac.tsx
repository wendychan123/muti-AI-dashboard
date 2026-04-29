import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import { supabase } from "@/lib/supabase";
import { useUserContext } from "@/contexts/UserContext";
import { buildStudentPracPrompt } from "@/lib/ai/buildStudentPracPrompt";
import dayjs from "dayjs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Filter, 
  Activity,
  HelpCircle,
  Bot
} from "lucide-react";
import _ from "lodash"; 

/* =========================
   Types Definitions
   ========================= */

interface DailyRow {
  user_id: number;
  user_sn: string;
  activity_date: string; 
  d_prac_count: number;
  d_learn_time_sec: number;
  d_avg_score_rate: number;
  d_avg_efficiency: number;
  d_total_wrong: number;
}

interface AttemptRow {
  prac_answer_sn: number;
  user_id: number;
  user_sn: number;
  activity_date: string;
  date: string; 
  subject_name: string;
  indicator: string;
  indicate_name: string;
  during_time: number;
  score_rate: number;
  items_count: number;
  accuracy_diff?: number;
  time_diff?: number;
  learning_pattern?: string;
}

interface IndicatorRow {
  user_sn: number;
  indicator: string;
  indicate_name: string;
  in_prac_count: number;
  in_avg_score_rate: number;
}

interface OrgIndicatorRow {
  subject_name: string;
  indicator: string;
  indicate_name: string;
  participant_count: number;
  school_avg_score_rate: number; 
  school_prac_count: number;
  school_avg_time_sec: number;
}

interface PracItemRow {
  prac_answer_sn: number;
  user_id: number;
  user_sn: number;
  date: string;
  activity_date: string;
  subject_name: string;
  indicator: string;
  indicate_name: string;
  item_index: number;
  is_correct: number; 
  during_time: number; 
  ans_time_ms: number;  
}

interface PracDetailRow {
  prac_answer_sn: number;
  date: string;
  items: PracItemRow[];
  avg_item_time_ms: number;
  score_rate: number;
}

interface DiffBarRow {
  indicator: string;       
  indicate_name: string;   
  classAvg: number;        
  latestScore: number;  
  original_name: string;   
  historicalAvg: number;   
  latestDiff: number;      
  avgDiff: number;         
}

interface IndicatorAssocRow {
  subject_name: string;
  source_indicate: string;   
  target_indicate: string;   
  source_name: string;       
  target_name: string;      
  correlation_score: number;
}

type HeatmapData = {
  x: string[];
  y: string[];
  z: number[][];
};

type ExplainTarget =
  | "daily_overview"    
  | "practice_trend"    
  | "score_trend"       
  | "indicator_effect"  
  | "learning_process"  
  | "indicator_gap"
  | "progress_trend"
  | "indicator_assoc";   

/* =========================
   Main Component
   ========================= */

export default function StudentPrac() {
  const navigate = useNavigate();
  const { userSn, organizationId } = useUserContext();

  // State
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const [attemptsData, setAttemptsData] = useState<AttemptRow[]>([]);
  const [indicatorData, setIndicatorData] = useState<IndicatorRow[]>([]);
  const [OrgIndicatorData, setOrgIndicatorData] = useState<OrgIndicatorRow[]>([]);
  const [pracItems, setPracItems] = useState<PracItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [indicatorAssocData, setIndicatorAssocData] = useState<IndicatorAssocRow[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

  // 將單一字串改為陣列，支援多指標疊加比較
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);

  // AI
  const [showAI, setShowAI] = useState(false);
  const [geminiResult, setGeminiResult] = useState<string | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);

  /* =========================
     Data Fetching
     ========================= */
  useEffect(() => {
    const fetchData = async () => {
      if (!userSn) return;
      setLoading(true);

      const setDailyReq = supabase.from("prac_daily").select("*").eq("user_sn", userSn).order("activity_date", { ascending: true });
      const attemptsReq = supabase.from("prac_attempts").select("*").eq("user_sn", userSn).order("date", { ascending: true });
      const indicatorReq = supabase.from("prac_indicate").select("*").eq("user_sn", userSn);
      const OrgIndicatorReq = supabase.from("prac_organization").select("subject_name, indicator, indicate_name, school_avg_score_rate, participant_count, school_prac_count, school_avg_time_sec").eq("organization_id", organizationId);
      const itemsReq = supabase.from("prac_attempts_item").select("*").eq("user_sn", userSn).order("date", { ascending: true });
      const indicatorAssocReq = supabase.from("prac_indicator_assoc").select("*");

      const [DailyRes, attemptsRes, indicatorRes, OrgIndicatorRes, items, indicatorAssocRes,] =
        await Promise.all([setDailyReq, attemptsReq, indicatorReq, OrgIndicatorReq, itemsReq, indicatorAssocReq,]);

      if (attemptsRes.error) {
        console.error("Error fetching attempts:", attemptsRes.error);
      } else {
        const data = (attemptsRes.data as AttemptRow[]) || [];
        setAttemptsData(data);
        if (data.length > 0) {
          const sortedDates = data.map(d => d.date).filter(Boolean).sort();
          setStartDate(sortedDates[0]); 
          setEndDate(sortedDates[sortedDates.length - 1]); 
        } else {
          setStartDate(null);
          setEndDate(null);
        }
      }
      
      setDailyData((DailyRes.data as DailyRow[]) || []);
      setIndicatorData((indicatorRes.data as IndicatorRow[]) || []);
      setOrgIndicatorData(OrgIndicatorRes.data || []);
      setPracItems((items.data as PracItemRow[]) || []);
      setIndicatorAssocData((indicatorAssocRes.data as IndicatorAssocRow[]) || []);
      setLoading(false);
    };

    fetchData();
  }, [userSn, organizationId]);

  /* =========================
     Data Processing 
     ========================= */

  const uniqueSubjects = useMemo(() => {
    return _.uniq(attemptsData.map(d => d.subject_name)).sort();
  }, [attemptsData]);

  const filteredAttempts = useMemo(() => {
    return attemptsData.filter(d => {
      if (selectedSubject !== "all" && d.subject_name !== selectedSubject) return false;
      return true;
    });
  }, [attemptsData, selectedSubject]);

  const subjectPracItems = useMemo<PracItemRow[]>(() => {
    return pracItems.filter(i => {
      if (selectedSubject !== "all" && i.subject_name !== selectedSubject) return false;
      return true;
    });
  }, [pracItems, selectedSubject]);

  const detailAvailableIndicators = useMemo(() => {
    return _.uniq(subjectPracItems.map(i => i.indicate_name)).sort();
  }, [subjectPracItems]);

  // 詳細記錄表格，根據多選 selectedIndicators 過濾
  const filteredPracItems = useMemo<PracItemRow[]>(() => {
    if (selectedIndicators.length === 0) return subjectPracItems;
    return subjectPracItems.filter(i => selectedIndicators.includes(i.indicate_name));
  }, [subjectPracItems, selectedIndicators]);

  const detailedRows = useMemo<PracDetailRow[]>(() => {
    if (filteredPracItems.length === 0) return [];
    const byPrac: Record<number, PracItemRow[]> = _.groupBy(filteredPracItems, "prac_answer_sn");

    return Object.values(byPrac).map((items: PracItemRow[]) => {
      const first = items[0];
      const correctCount = items.filter(i => i.is_correct === 1).length;
      const totalCount = items.length;
      const totalSpentTime = Number(first.during_time || 0);

      return {
        prac_answer_sn: first.prac_answer_sn,
        date: first.date,
        items, 
        avg_item_time_ms: totalSpentTime, 
        score_rate: (correctCount / totalCount) * 100,
      };
    }).sort((a, b) => b.prac_answer_sn - a.prac_answer_sn);
  }, [filteredPracItems]);

  const maxItemCount = useMemo(() => {
    return Math.max(0, ...detailedRows.map((r) => r.items.length));
  }, [detailedRows]);

  const indicatorCodeToNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    indicatorData.forEach(d => {
      if (d.indicator && d.indicate_name) {
        map[d.indicator] = d.indicate_name;
      }
    });
    attemptsData.forEach(d => {
      if (d.indicator && d.indicate_name) {
        map[d.indicator] = d.indicate_name;
      }
    });
    return map;
  }, [indicatorData, attemptsData]);

  const filteredIndicatorAssoc = useMemo<IndicatorAssocRow[]>(() => {
    let mappedRows = indicatorAssocData.map(r => ({
      ...r,
      source_name: indicatorCodeToNameMap[r.source_indicate] || r.source_indicate,
      target_name: indicatorCodeToNameMap[r.target_indicate] || r.target_indicate,
    }));

    const practicedNames = new Set(filteredAttempts.map(d => d.indicate_name));
    mappedRows = mappedRows.filter(
      r => practicedNames.has(r.source_name) && practicedNames.has(r.target_name)
    );

    if (selectedSubject !== "all") {
      mappedRows = mappedRows.filter(r => r.subject_name === selectedSubject);
    }

    if (selectedIndicators.length > 0) {
      mappedRows = mappedRows.filter(
        r =>
          selectedIndicators.includes(r.source_name) ||
          selectedIndicators.includes(r.target_name)
      );
    }

    return mappedRows;
  }, [indicatorAssocData, selectedSubject, selectedIndicators, filteredAttempts, indicatorCodeToNameMap]);

  
  // KPI 
    const processedStats = useMemo(() => {
      const totalAttemptsCount = filteredAttempts.length;
      const matchedOrgRows = OrgIndicatorData.filter(d => selectedSubject === "all" || d.subject_name === selectedSubject);
      const userCount = matchedOrgRows.length > 0 ? Math.max(...matchedOrgRows.map(d => d.participant_count || 0)) : 0;
      const schoolTotalPracSum = _.sumBy(matchedOrgRows, "school_prac_count");
      const schoolAvgCount = userCount > 0 ? (schoolTotalPracSum / userCount).toFixed(1) : "0.0";
      const attemptsByIndicator = _.groupBy(filteredAttempts, "indicate_name");
      const unitCount = Object.keys(attemptsByIndicator).length; 
      const totalTime = Math.round(_.sumBy(filteredAttempts, "during_time"));
      const schoolTotalTimeSec = _.sumBy(matchedOrgRows, r => (r.school_avg_time_sec || 0) * (r.school_prac_count || 0));
      const schoolAvgTotalTime = userCount > 0 ? Math.round(schoolTotalTimeSec / userCount) : 0;
      const timeDiff = totalTime - schoolAvgTotalTime; 
      const avgScore = totalAttemptsCount > 0 ? _.meanBy(filteredAttempts, "score_rate") : 0;
      const avgSpeedSec = totalAttemptsCount > 0 ? (_.meanBy(filteredAttempts, "avg_item_time_ms") / 1000).toFixed(1) : "0.0";
  
      let improvedCount = 0; 
      let perfectCount = 0;  
      let struggleCount = 0; 
      
      // 紀錄具體的指標名稱
      let improvedIndicators: string[] = [];
      let perfectIndicators: string[] = [];
  
      Object.entries(attemptsByIndicator).forEach(([indicate_name, attempts]: [string, AttemptRow[]]) => {
        const sorted = _.orderBy(attempts, ["date", "id"], ["asc", "asc"]);
        if (!sorted.length) return;
        const latest = sorted[sorted.length - 1];
        const latestScore = Number(latest.score_rate);
        const everLow = sorted.some(a => (Number(a.score_rate) > 1 ? Number(a.score_rate) < 60 : Number(a.score_rate) < 0.6));
        const isLatestPerfect = latestScore === 100 || latestScore >= 0.99;
        
        if (isLatestPerfect) { 
          if (everLow) {
            improvedCount++; 
            improvedIndicators.push(indicate_name);
          } else {
            perfectCount++;  
            perfectIndicators.push(indicate_name);
          }
        }
        if (latestScore > 1 ? latestScore < 60 : latestScore < 0.6) struggleCount++;
      });
  
      return {
        count: unitCount, userCount, schoolAvgCount, totalTime, schoolAvgTotalTime, timeDiff, 
        avgScore: Math.round(avgScore * 100), avgSpeedSec, struggleCount, improvedCount, perfectCount,
        reachedGoal: struggleCount === 0 && (improvedCount > 0 || perfectCount > 0),
        improvedIndicators, perfectIndicators // 輸出給 KPI 使用
      };
    }, [filteredAttempts, OrgIndicatorData, selectedSubject]);

  const belowClassAvgStats = useMemo(() => {
      if (!filteredAttempts.length) return { count: 0, classPracPeople: null, needsEffortIndicators: [] };
      const attemptsByIndicator = _.groupBy(filteredAttempts, "indicate_name");
      let struggleCount = 0;
      let needsEffortIndicators: string[] = [];
  
      Object.entries(attemptsByIndicator).forEach(([indicate_name, attempts]: [string, AttemptRow[]]) => {
        const hasPerfectRecord = attempts.some(a => (a.score_rate >= 0.99 && a.score_rate <= 1) || a.score_rate === 100);
        if (!hasPerfectRecord) {
          struggleCount++;
          needsEffortIndicators.push(indicate_name);
        }
      });
      
      const classPracPeople = OrgIndicatorData.length > 0 ? Math.max(...OrgIndicatorData.map(c => c.participant_count || 0)) : null;
      return { count: struggleCount, classPracPeople, needsEffortIndicators };
    }, [filteredAttempts, OrgIndicatorData]);

  const filteredIndicators = useMemo(() => {
    if (selectedSubject === "all") return indicatorData;
    const activeNames = new Set(filteredAttempts.map(d => d.indicate_name));
    return indicatorData.filter(d => activeNames.has(d.indicate_name));
  }, [indicatorData, filteredAttempts, selectedSubject]);

  const periodLabel = useMemo(() => {
    if (filteredAttempts.length === 0) return "資料期間：無數據";
    const dates = filteredAttempts.map(d => d.date).sort();
    const start = dates[0];
    const end = dates[dates.length - 1];
    const s = dayjs(start).format("YYYY/MM/DD");
    const e = dayjs(end).format("YYYY/MM/DD");
    const days = dayjs(end).diff(dayjs(start), "day") + 1;
    return `篩選資料期間：${s} ～ ${e}（${days} 天）`;
  }, [filteredAttempts]); 

  /* =========================
     Chart Data Preparation
     ========================= */

  const chart1Data = useMemo(() => {
    if (!filteredIndicators.length) return { xShort: [], xFull: [], yBar: [], yLine: [], meta: [] };
    const sorted = _.orderBy(filteredIndicators, ["in_prac_count"], ["desc"]);
    return {
      xShort: sorted.map(d => d.indicator),
      xFull: sorted.map(d => d.indicate_name),
      yBar: sorted.map(d => d.in_prac_count),
      yLine: sorted.map(d => Math.round(d.in_avg_score_rate)),
      meta: sorted.map(d => ({ indicate_name: d.indicate_name, prac_count: d.in_prac_count, avg_score: Math.round(d.in_avg_score_rate) })),
    };
  }, [filteredIndicators]);
  
  const calculateMedian = (values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const ZONE_COLOR: Record<string, string> = {
    精熟區: "#22c55e", 穩定區: "#3b82f6", 猜測區: "#f97316", 卡關區: "#ef4444",
  };

  // 圖表二：學習歷程表現圖 (支援多指標陣列)
const chart3Data = useMemo(() => {
  if (!filteredAttempts.length) return { mode: "overview", passScore: 60, traces: [] };
  const passScore = 60;
  const zoneOf = (acc: number, timeSec: number, median: number) => {
    if (acc >= passScore && timeSec <= median) return "精熟區";
    if (acc >= passScore && timeSec > median) return "穩定區";
    if (acc < passScore && timeSec <= median) return "猜測區";
    return "卡關區";
  };

  if (selectedIndicators.length === 0) {
    // 模式 A：總覽模式 (顯示所有最新作答)
    const attemptsByIndicator = _.groupBy(filteredAttempts, "indicate_name");
    const latestAttempts = Object.values(attemptsByIndicator).map((attempts: AttemptRow[]) => {
      const sorted = _.orderBy(attempts, ["date", "prac_answer_sn"], ["asc", "asc"]);
      const latest = sorted[sorted.length - 1];
      return { ...latest, avg_item_time_sec: latest.items_count > 0 ? latest.during_time / latest.items_count : 0 };
    }).filter(a => a.items_count > 0);

    const timeSecValues = latestAttempts.map(d => d.avg_item_time_sec);
    const medianTimeSec = calculateMedian(timeSecValues) || 5;

    const overviewTrace = {
      x: latestAttempts.map(d => d.avg_item_time_sec),
      y: latestAttempts.map(d => d.score_rate),
      mode: "markers", 
      type: "scatter" as const,
      text: latestAttempts.map(d => d.indicate_name),
      marker: {
        size: 14,
        // 將原本的 ZONE_COLOR 邏輯改為固定灰色
        color: "#94a3b8", 
        opacity: 0.7,
        line: { color: "white", width: 1.5 },
      },
      customdata: latestAttempts.map(d => [zoneOf(d.score_rate, d.avg_item_time_sec, medianTimeSec), d.items_count]),
      hovertemplate:
        "<b>%{text}</b><br>" + 
        "狀態：%{customdata[0]}<br>" +
        "作答時間：%{x:.1f} 秒/題<br>" +
        "正確率：%{y:.0f}%<br>" +
        "<i>(點擊查看歷次進步軌跡)</i><extra></extra>",
      name: "最新作答",
      
    };

    return {
      mode: "overview",
      medianTimeSec,
      passScore,
      traces: [overviewTrace],
      aiData: latestAttempts.map(d => ({
        單元名稱: d.indicate_name,
        平均作答秒數: Math.round(d.avg_item_time_sec * 10) / 10,
        正確率: Math.round(d.score_rate),
        落點區域: zoneOf(d.score_rate, d.avg_item_time_sec, medianTimeSec)
      }))
    };
  } else {
    // 模式 B：詳細歷程模式 (支援多指標，為每個指標畫一條軌跡)
    const colors = ["#2563eb", "#16b40bff", "#d97706", "#8b5cf6"];
    const traces: any[] = [];
    let globalMedian = 5;
    const allValidPoints: any[] = [];

    selectedIndicators.forEach((ind, idx) => {
      const color = colors[idx % colors.length];
      const specificAttempts = filteredAttempts.filter(a => a.indicate_name === ind);
      const sorted = _.orderBy(specificAttempts, ["date", "prac_answer_sn"], ["asc", "asc"]);
      const validPoints = sorted.map((a, i) => ({
        ...a, attemptIndex: i + 1, isLatest: i === sorted.length - 1,
        avg_item_time_sec: a.items_count > 0 ? a.during_time / a.items_count : 0,
      })).filter(a => a.items_count > 0);
      
      if(validPoints.length === 0) return;
      allValidPoints.push(...validPoints);

      const timeSecValues = validPoints.map(d => d.avg_item_time_sec);
      const medianTimeSec = calculateMedian(timeSecValues) || 5;
      globalMedian = medianTimeSec; 

      // 歷史軌跡線 + 點
      traces.push({
        x: validPoints.map(d => d.avg_item_time_sec),
        y: validPoints.map(d => d.score_rate),
        mode: "lines+markers+text",
        type: "scatter",
        text: validPoints.map(d => String(d.attemptIndex)),
        textposition: "top center",
        line: { color: color, width: 2, dash: "dot" }, 
        marker: {
          size: 14,
          color: "#9fa5aeff", 
          opacity: 0.8,
          line: { color: color, width: 3 }, // 邊框保留指標顏色
        },
        customdata: validPoints.map(d => zoneOf(d.score_rate, d.avg_item_time_sec, medianTimeSec)),
        hovertemplate:
          `<b>${ind} (第%{text}次)</b><br>` +
          "作答時間：%{x:.1f} 秒/題<br>" +
          "正確率：%{y:.0f}%<br>" +
          "狀態：<b>%{customdata}</b><extra></extra>",
        name: ind,
      });

      // 最新點加上特別框線
      const latest = validPoints[validPoints.length - 1];
      traces.push({
        x: [latest.avg_item_time_sec],
        y: [latest.score_rate],
        mode: "markers",
        type: "scatter",
        marker: {
          size: 18,
          color: "rgba(255, 255, 255, 0)",
          line: { color: "#fffb00ff", width: 4 }, 
        },
        hoverinfo: "skip",
        showlegend: false,
      });
    });

    if (allValidPoints.length > 0) {
      globalMedian = calculateMedian(allValidPoints.map(d => d.avg_item_time_sec));
    }

    return {
      mode: "detail",      
      medianTimeSec: globalMedian,
      passScore,
      traces,
      aiData: allValidPoints.map(d => ({
        單元名稱: d.indicate_name,
        練習次序: `第 ${d.attemptIndex} 次`,
        平均作答秒數: Math.round(d.avg_item_time_sec * 10) / 10,
        正確率: Math.round(d.score_rate),
        落點區域: zoneOf(d.score_rate, d.avg_item_time_sec, globalMedian)
      }))
    };
  }
}, [filteredAttempts, selectedIndicators]);

  const activeIndicators = useMemo(() => {
    return _.uniqBy(filteredAttempts.map(d => ({ subject_name: d.subject_name, indicate_name: d.indicate_name })), d => `${d.subject_name}__${d.indicate_name}`);
  }, [filteredAttempts]);
    
  const matchedClassIndicators = useMemo(() => {
    if (!OrgIndicatorData.length) return [];
    return activeIndicators.map(({ subject_name, indicate_name }) => {
      const classRow = OrgIndicatorData.find(c => c.subject_name === subject_name && c.indicate_name === indicate_name);
      return classRow ? { subject_name, indicator: classRow.indicator, indicate_name, class_avg_score_rate: classRow.school_avg_score_rate } : null;
    }).filter(Boolean);
  }, [activeIndicators, OrgIndicatorData]);
    
  const avgScoreCompare = useMemo(() => {
    if (!filteredAttempts.length || !matchedClassIndicators.length) return { studentAvg: 0, classAvg: null, diff: null };
    const studentAvg = _.meanBy(filteredAttempts, "score_rate");
    const classAvg = _.meanBy(matchedClassIndicators, "class_avg_score_rate");
    return { studentAvg: Math.round(studentAvg), classAvg: Math.round(classAvg), diff: Math.round(studentAvg - classAvg) };
  }, [filteredAttempts, matchedClassIndicators]);

  const diffBarData = useMemo<DiffBarRow[]>(() => {
    if (!filteredAttempts.length || !matchedClassIndicators.length) return [];
    const splitLongText = (str: string, len: number = 20) => str ? (str.match(new RegExp(`.{1,${len}}`, "g"))?.join("<br>") || str) : "";
    const groups = _.groupBy(filteredAttempts, "indicate_name");

    const rows = Object.entries(groups).map(([indicate_name, attempts]) => {
      const classRow = matchedClassIndicators.find(c => c.indicate_name === indicate_name);
      if (!classRow) return null;
      const classAvg = classRow.class_avg_score_rate;
      const sorted = _.orderBy(attempts, ["date", "prac_answer_sn"], ["asc", "asc"]);
      const latestScore = sorted[sorted.length - 1].score_rate;
      return {
        indicator: classRow.indicator || "", 
        indicate_name: splitLongText(indicate_name, 20),
        original_name: indicate_name,
        latestScore: Math.round(latestScore), 
        classAvg: Math.round(classAvg), 
        latestDiff: Math.round(latestScore - classAvg),
        historicalAvg: 0, avgDiff: 0 
      };
    }).filter(Boolean) as DiffBarRow[];

    return _.orderBy(rows, ["latestDiff"], ["asc"]);
  }, [filteredAttempts, matchedClassIndicators]);

  const formatDateTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }).replace(/\//g, '-'); 
  };

  /* =========================
   練習投入(花費時間)與正確率走勢 
  ========================= */
const trendPlotData = useMemo(() => {
  const rawData = (attemptsData || []) as AttemptRow[];
  
  const baseFiltered = rawData
    .filter(d => selectedSubject === "all" || d.subject_name === selectedSubject)
    .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());

  const formatLabel = (isoDate: string) => {
    const localTimeStr = isoDate.replace(/Z/g, '').split('+')[0];
    return dayjs(localTimeStr).format("MM/DD HH:mm"); 
  };

  const groupByDate = (rows: AttemptRow[]) => {
    const grouped = _.groupBy(rows, (r) => formatLabel(r.date));
    
    return Object.entries(grouped).map(([date, gRows]) => {
      const currentRows = gRows as AttemptRow[]; 
      const totalPrac = currentRows.length;
      const totalTimeSec = Math.round(_.sumBy(currentRows, "during_time"));
      const totalItems = _.sumBy(currentRows, "items_count");
      const weightScoreSum = _.sumBy(currentRows, (r) => (r.score_rate || 0) * (r.items_count || 0));
      
      return { 
        date, 
        totalPrac, 
        totalTimeSec, 
        avgScore: totalItems > 0 ? Math.round(weightScoreSum / totalItems) : 0 
      };
    }).sort((a, b) => dayjs(a.date, "MM/DD HH:mm:ss").valueOf() - dayjs(b.date, "MM/DD HH:mm:ss").valueOf());
  };

  if (selectedIndicators.length === 0) {
    const globalData = groupByDate(baseFiltered);
    return {
       practice: [
         { x: globalData.map(t => t.date), y: globalData.map(t => t.totalTimeSec), type: "scatter", mode: "lines+markers", name: "花費時間 (秒)", line: { color: "#2563eb", width: 3 }, hoverlabel: { align: "left" }, hovertemplate: "花費時間：%{y} 秒<extra></extra>" }
       ],
       score: [
         { x: globalData.map(t => t.date), y: globalData.map(t => t.avgScore), type: "scatter", mode: "lines+markers", name: "我的正確率", line: { color: "#2563eb", width: 3, shape: 'spline' }, hoverlabel: { align: "left" }, hovertemplate: "正確率：%{y:.0f}% <extra></extra>" },
         { x: globalData.map(t => t.date), y: globalData.map(() => avgScoreCompare.classAvg || 0), type: "scatter", mode: "lines", name: `全校平均 (${avgScoreCompare.classAvg}%)`, line: { color: "#ef4444", width: 2, dash: "dash" }, hoverinfo: "skip" }
       ],
       rawGlobal: globalData,
       aiTrendData: globalData.map(t => ({ date: t.date, 花費時間: t.totalTimeSec, 正確率: t.avgScore })),
       dates: globalData.map(t => t.date) 
    };
  } else {
    const colors = ["#2563eb", "#20d913ff", "#d97706", "#8b5cf6"];
    const practice: any[] = [];
    const score: any[] = [];
    let allDatesSet = new Set<string>();

    selectedIndicators.forEach((ind, idx) => {
       const color = colors[idx % colors.length];
       const indData = groupByDate(baseFiltered.filter(d => d.indicate_name === ind));
       indData.forEach(d => allDatesSet.add(d.date));

       const shortIndName = ind.length > 18 ? ind.substring(0, 18) + "..." : ind;

       practice.push({
         x: indData.map(t => t.date), 
         y: indData.map(t => t.totalTimeSec), 
         type: "scatter", mode: "lines+markers", 
         name: shortIndName,
         line: { color, width: 3 }, 
         hoverlabel: { align: "left" },
         hovertemplate: `<b>${ind}</b><br>花費時間：%{y} 秒<extra></extra>`
       });
       score.push({
         x: indData.map(t => t.date), 
         y: indData.map(t => t.avgScore), 
         type: "scatter", mode: "lines+markers", 
         name: shortIndName, 
         line: { color, width: 3, shape: 'spline' }, 
         hoverlabel: { align: "left" },
         hovertemplate: `<b>${ind}</b><br>正確率：%{y:.0f}%<extra></extra>`
       });
    });

    const sortedAllDates = Array.from(allDatesSet).sort((a, b) => 
      dayjs(a, "MM/DD HH:mm:ss").valueOf() - dayjs(b, "MM/DD HH:mm:ss").valueOf()
    );

    score.push({
         x: sortedAllDates, 
         y: sortedAllDates.map(() => avgScoreCompare.classAvg || 0), 
         type: "scatter", mode: "lines", name: `全校平均`, line: { color: "#ef4444", width: 2, dash: "dash" }, hoverinfo: "skip"
    });

      const aiTrendData = selectedIndicators.map(ind => {
      const indData = groupByDate(baseFiltered.filter(d => d.indicate_name === ind));
      return {
        單元名稱: ind,
        趨勢紀錄: indData.map(t => ({ date: t.date, 花費時間: t.totalTimeSec, 正確率: t.avgScore }))
      };
    });

    return { practice, score, aiTrendData, dates: sortedAllDates };
  }
}, [attemptsData, selectedSubject, selectedIndicators, avgScoreCompare.classAvg]);

  

  /* =========================
    錯題關聯圖 
  ========================= */
  const assocHeatmapData = useMemo(() => {
    if (!filteredIndicatorAssoc.length) return null;

    const indicators = _.uniq([
      ...filteredIndicatorAssoc.map(d => d.source_indicate),
      ...filteredIndicatorAssoc.map(d => d.target_indicate),
    ]);

    const nameMap: Record<string, string> = {};
    filteredIndicatorAssoc.forEach(d => {
      nameMap[d.source_indicate] = d.source_name;
      nameMap[d.target_indicate] = d.target_name;
    });

    const indicatorNames = indicators.map(code => nameMap[code]);

    const matrix = indicators.map(row =>
      indicators.map(col => {
        if (row === col) return 1; 

        const match = filteredIndicatorAssoc.find(
          d =>
            (d.source_indicate === row && d.target_indicate === col) ||
            (d.source_indicate === col && d.target_indicate === row)
        );

        return match ? dmatchScore(match.correlation_score) : 0;
      })
    );

    return { 
      x: indicators, 
      y: indicators, 
      z: matrix,
      customX: indicatorNames, 
      customY: indicatorNames  
    };
  }, [filteredIndicatorAssoc]);

function dmatchScore(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
}

const topAssocPairs = useMemo(() => {
  return [...filteredIndicatorAssoc]
    .sort((a, b) => b.correlation_score - a.correlation_score)
    .slice(0, 10);
}, [filteredIndicatorAssoc]);

  /* =========================
     AI 助手
  ========================= */
  const runAIForChart = async (chart: ExplainTarget) => {
    setGeminiLoading(true);
  
    const prompt = buildStudentPracPrompt({
    // 修正：傳入實際的資料起訖日期
    date: startDate && endDate ? `${startDate} ~ ${endDate}` : null,
    subject: selectedSubject,
    // 核心修正：傳入陣列，讓 AI 知道現在是單選、多選還是總覽
    selectedIndicators: selectedIndicators, 
    selectedCharts: [chart], // (若是 multi-request 則為 explainTargets)
    stats: {
      avgScore: avgScoreCompare.studentAvg,
      avgSpeedSec: Number(processedStats.avgSpeedSec),
      totalCount: processedStats.count,
      belowClassCount: belowClassAvgStats.count,
      reachedGoal: processedStats.reachedGoal,
    },
    chartData: {
      // 這裡全部替換成我們剛剛提煉的乾淨資料！
      practiceTrend: trendPlotData.aiTrendData, 
      scoreTrend: trendPlotData.aiTrendData,
      indicatorEffect: chart1Data.meta, 
      learningProcess: chart3Data.aiData, 
      // 差距圖直接 map 出乾淨的物件
      indicatorGap: diffBarData.map(d => ({ 
        單元名稱: d.original_name, 
        你的正確率: d.latestScore, 
        校平均: d.classAvg, 
        落差: d.latestDiff 
      })),
      // 關聯圖提取中文名稱與機率
      indicatorAssoc: topAssocPairs.map(p => ({ 
        單元A: p.source_name, 
        單元B: p.target_name, 
        關聯度: `${Math.round(p.correlation_score * 100)}%` 
      }))
    }
  });
  
    window.dispatchEvent(
      new CustomEvent("student-ai-update", {
        detail: { loading: true, questions: [EXPLAIN_LABEL_MAP[chart]] }
      })
    );
  
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, role: "student" }),
    });
  
    const data = await res.json();
  
    setGeminiResult(data.text);
    setShowAI(true);
    setGeminiLoading(false);
  
    window.dispatchEvent(
      new CustomEvent("student-ai-update", {
        detail: { loading: false, content: data.text },
      })
    );
  };
  
  const runOverviewAI = () => {
    runAIForChart("daily_overview");
  };
  
  /* =========================
     多圖整合 AI 監聽
  ========================= */
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.charts) return;
  
      const chartLabels: string[] = detail.charts;
      const explainTargets: ExplainTarget[] = chartLabels.map(label => LABEL_TO_EXPLAIN_KEY[label]).filter(Boolean);
  
      if (explainTargets.length === 0) return;
      setGeminiLoading(true);
  
      const prompt = buildStudentPracPrompt({
        // 修正：傳入實際的資料起訖日期
        date: startDate && endDate ? `${startDate} ~ ${endDate}` : null,
        subject: selectedSubject,
        // 核心修正：傳入陣列，讓 AI 知道現在是單選、多選還是總覽
        selectedIndicators: selectedIndicators, 
        selectedCharts: explainTargets, 
        stats: {
          avgScore: avgScoreCompare.studentAvg,
          avgSpeedSec: Number(processedStats.avgSpeedSec),
          totalCount: processedStats.count,
          belowClassCount: belowClassAvgStats.count,
          reachedGoal: processedStats.reachedGoal,
        },
        chartData: {
          // 這裡全部替換成我們剛剛提煉的乾淨資料！
          practiceTrend: trendPlotData.aiTrendData, 
          scoreTrend: trendPlotData.aiTrendData,
          indicatorEffect: chart1Data.meta, 
          learningProcess: chart3Data.aiData, 
          // 差距圖直接 map 出乾淨的物件
          indicatorGap: diffBarData.map(d => ({ 
            單元名稱: d.original_name, 
            你的正確率: d.latestScore, 
            校平均: d.classAvg, 
            落差: d.latestDiff 
          })),
          // 關聯圖提取中文名稱與機率
          indicatorAssoc: topAssocPairs.map(p => ({ 
            單元A: p.source_name, 
            單元B: p.target_name, 
            關聯度: `${Math.round(p.correlation_score * 100)}%` 
          }))
        }
      });
  
      window.dispatchEvent(new CustomEvent("student-ai-update", { detail: { loading: true, questions: chartLabels } }));
  
      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, role: "student" }),
        });
        const data = await res.json();
        setGeminiResult(data.text);
        setShowAI(true);
        setGeminiLoading(false);
  
        window.dispatchEvent(new CustomEvent("student-ai-update", { detail: { loading: false, content: data.text } }));
      } catch (err) {
        console.error("Multi AI error:", err);
        setGeminiLoading(false);
      }
    };
  
    window.addEventListener("student-ai-multi-request", handler);
    return () => { window.removeEventListener("student-ai-multi-request", handler); };
  }, [
    selectedIndicators,
    chart1Data,
    chart3Data,
    diffBarData,
    assocHeatmapData,
    trendPlotData,
    selectedDate,
    selectedSubject,
    avgScoreCompare,
    processedStats,
    belowClassAvgStats,
  ]);
  
  
  const EXPLAIN_CHART_OPTIONS: {
    key: ExplainTarget;
    label: string;
    description: string;
  }[] = [
    { key: "daily_overview", label: "總覽練習概況", description: "總覽投入時間與正確率變化" },
    { key: "indicator_effect", label: "知識節點練習次數", description: "各知識節點的練習次數與表現" },
    { key: "indicator_assoc", label: "知識節點弱點關聯", description: "分析哪些知識節點容易一起出現學習困難" },
    { key: "indicator_gap", label: "與全校平均的差距", description: "各知識節點與全校平均的差距" },
    { key: "learning_process", label: "學習歷程表現", description: "答題速度 × 正確率的學習區域" },
    { key: "practice_trend", label: "練習時間走勢", description: "分析練習時間與次數的規律性" },
    { key: "score_trend", label: "正確率走勢", description: "分析正確率隨時間進步的幅度" },
  ];
  
  const EXPLAIN_LABEL_MAP: Record<ExplainTarget, string> =
    Object.fromEntries(EXPLAIN_CHART_OPTIONS.map(opt => [opt.key, opt.label])) as Record<ExplainTarget, string>;
  
  const LABEL_TO_EXPLAIN_KEY: Record<string, ExplainTarget> = {
    "總覽練習狀況": "daily_overview",
    "知識節點練習次數": "indicator_effect",
    "知識節點弱點關聯": "indicator_assoc",
    "與全校平均的差距": "indicator_gap",
    "練習時間走勢": "practice_trend",
    "正確率走勢": "score_trend",
    "學習歷程表現": "learning_process",
  };

  const currentSelectValue = selectedIndicators.length === 1 
    ? selectedIndicators[0] 
    : (selectedIndicators.length === 0 ? "all" : "multiple");

  /* =========================
     Render
     ========================= */
  return (
    <div className="min-h-screen p-4 space-y-6">

      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 p-2 pb-1">
          <div className="p-2 text-slate-400"><Filter className="w-5 h-5"/></div>
          <span className="text-sm">選擇科目：</span>
          <Select
            value={selectedSubject}
            onValueChange={(val) => {
              setSelectedSubject(val);
              setSelectedIndicators([]); 
            }}
          >
            <SelectTrigger className="w-[150px] font-medium text-slate-700 bg-white border rounded">
              <SelectValue placeholder="選擇科目"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部科目</SelectItem>
              {uniqueSubjects.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
            </SelectContent>
          </Select>

          <button
            onClick={runOverviewAI}
            disabled={geminiLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm ${geminiLoading ? "bg-slate-300 text-slate-600" : "bg-blue-500 text-white hover:bg-blue-700"}`}
          >
            {geminiLoading ? <><span className="animate-spin"></span>分析中…</> : <>總覽練習狀況</>}
          </button>
        </div>
      </div>

      <div className="flex justify-end px-4 -mt-1"><span className="text-xs text-slate-400">{periodLabel}</span></div>

      {/* 2. KPI Cards  */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: 次數 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            練習的單元數
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-4xl font-black text-slate-700 tracking-tight">
              {processedStats.count.toLocaleString()}
            </div>
          </div>
        </div>

        {/* KPI 2: 總投入時間 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            投入練習總時間
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-4xl font-black text-slate-700 tracking-tight">
              {Math.round(processedStats.totalTime / 60).toLocaleString()} <span className="text-base">分</span>
            </div>
          </div>
        </div>

        {/* KPI 3: 平均正確率 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            平均答對率
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-3xl font-black text-slate-700 tracking-tight">
              {avgScoreCompare.studentAvg} %
            </div>
            <div className="text-[11px] text-center text-slate-400 font-medium mt-1">
              <span className="text-slate-500">校平均 {avgScoreCompare.classAvg} % </span>
              <span className={avgScoreCompare.diff >= 0 ? "text-green-500" : "text-red-500"}>
                ({avgScoreCompare.diff >= 0 ? "+" : ""}{avgScoreCompare.diff}%)
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: 低於校平均 (附帶 Tooltip & 點擊連動) */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            目前表現狀態
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className={`text-xl font-black tracking-tight ${belowClassAvgStats.count > 0 ? "text-red-500" : "text-blue-600"}`}>
              {belowClassAvgStats.count > 0 ? "還要再加油" : "都全對了"}
            </div>
              <div className="text-[11px] text-slate-500 mt-2 text-center">
              {belowClassAvgStats.count > 0 
                ? `尚有 ${belowClassAvgStats.count} 項單元可以再挑戰` 
                : "已完成所有指標且都滿分"}
            </div>
          </div>
        </div>

        {/* KPI 5：目標達成率 (附帶 Tooltip & 點擊連動) */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            我的學習挑戰
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className={`text-xl font-black tracking-tight ${processedStats.reachedGoal ? "text-blue-600" : "text-red-500"}`}>
              {processedStats.reachedGoal ? "成功" : "繼續努力"}
            </div>
            <div className="gap-2 mt-3 font-bold text-center flex flex-col">
              {/* 搞懂的弱點 */}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger className="text-[10px] bg-slate-100 text-slate-600 px-3 py-1 rounded border border-slate-200 cursor-help hover:bg-slate-200 transition">
                    搞懂的單元：{processedStats.improvedCount}
                  </TooltipTrigger>
                  {processedStats.improvedIndicators.length > 0 && (
                    <TooltipContent side="bottom" className="bg-white border-slate-200 text-slate-700 shadow-xl max-w-xs p-3">
                      <p className="font-bold mb-2 text-blue-600">從不會到會的單元：</p>
                      <ul className="list-disc pl-4 text-xs space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar font-medium text-left">
                        {processedStats.improvedIndicators.map(ind => (
                          <li 
                            key={ind}
                            className="cursor-pointer hover:text-blue-600 transition-colors underline decoration-transparent hover:decoration-blue-400 underline-offset-4"
                            onClick={() => setSelectedIndicators([ind])}
                            title="點擊查看此單元的詳細圖表"
                          >
                            {ind}
                          </li>
                        ))}
                      </ul>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              {/* 一次就全對 */}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger className="text-[10px] bg-slate-100 text-slate-600 px-3 py-1 rounded border border-slate-200 cursor-help hover:bg-slate-200 transition">
                    一次就全對：{processedStats.perfectCount}
                  </TooltipTrigger>
                  {processedStats.perfectIndicators.length > 0 && (
                    <TooltipContent side="bottom" className="bg-white border-slate-200 text-slate-700 shadow-xl max-w-xs p-3">
                      <p className="font-bold mb-2 text-emerald-600">表現超棒的單元：</p>
                      <ul className="list-disc pl-4 text-xs space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar font-medium text-left">
                        {processedStats.perfectIndicators.map(ind => (
                          <li 
                            key={ind}
                            className="cursor-pointer hover:text-emerald-600 transition-colors underline decoration-transparent hover:decoration-emerald-400 underline-offset-4"
                            onClick={() => setSelectedIndicators([ind])}
                            title="點擊查看此單元的詳細圖表"
                          >
                            {ind}
                          </li>
                        ))}
                      </ul>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Charts Grid */}

      
        {/* ===== 需要再加油的知識節點 ===== */}
        <Card className="col-span-1 relative flex flex-col">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-xl font-bold text-slate-700 flex items-center gap-2">
              需要再加強的知識節點
              {belowClassAvgStats.count > 0 && (
                <span className="bg-rose-100 text-rose-600 text-[10px] px-4 rounded-full ">
                  剩餘 {belowClassAvgStats.count} 項
                </span>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-3 flex-1 overflow-hidden">
            {belowClassAvgStats.count > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400 mb-2">點擊單元名稱，下方圖表會自動為你診斷：</p>
                <ul className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                  {belowClassAvgStats.needsEffortIndicators.map((ind) => (
                    <li
                      key={ind}
                      onClick={() => {
                        setSelectedIndicators([ind]);
                        document.getElementById('trend-charts-area')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`
                        group flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition-all cursor-pointer
                        ${selectedIndicators.includes(ind) 
                          ? "bg-blue-50 text-blue-700 border border-blue-200" 
                          : "bg-slate-50 text-slate-600 border border-transparent hover:bg-slate-100 hover:text-blue-600"
                        }
                      `}
                    >
                      <div className={` ${selectedIndicators.includes(ind) }`} />
                      <span className="flex-1 truncate">{ind}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-6 text-center">
                <p className="text-xs text-slate-400 mt-1">目前所有單元都已經滿分囉</p>
              </div>
            )}
          </CardContent>
        </Card>

      <Card className="col-span-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <Activity className="animate-spin mr-2 w-4 h-4" />
            <span className="text-sm text-slate-600">弱點分析中...</span>
          </div>
        )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-2 bg-slate-50/50">
            <CardTitle
              className="text-xl font-bold cursor-pointer hover:opacity-70 transition flex items-center gap-2"
              onClick={() => setSelectedIndicators([])}
            >
              知識節點弱點關聯
            </CardTitle>

            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="w-8 h-8 rounded-full text-slate-400 hover:bg-white transition shadow-sm">
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f5f4fb] shadow-xl border-slate-200 text-slate-700 z-50">
                        <div className="space-y-3">
                          <p className="font-bold border-b pb-1 text-blue-700">圖表計算說明：</p>
                          <ul className="text-xs space-y-2 list-disc pl-4">
                            <li><b>每個格子：</b>代表兩個知識節點之間的關聯強度。</li>
                        <li><b>顏色越深：</b>表示兩個能力越可能一起出現學習困難或表現關聯。</li>
                        <li><b>點擊熱點方格：</b>可立即啟動疊加比較模式，同時觀察這兩個指標的進步軌跡！</li>
                          </ul>
                          <p className="text-[12px] text-slate-400 pt-1 border-t">
                            ※ 找出容易一起卡住的關聯指標，一次擊破知識弱點群。
                          </p>
                        </div>
                      </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <button
                onClick={() => runAIForChart("indicator_assoc")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition shadow-sm"
              >
                <Bot className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-3 space-y-4">
            {/*診斷提示區 */}
            {selectedIndicators.length > 0 ? (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                {(() => {
                  const targetInd = selectedIndicators[0]; // 若選多個，以第一個作為基準推薦
                  const rawPairs = topAssocPairs.filter(
                    p => p.source_name === targetInd || p.target_name === targetInd
                  );
                  
                  const displayPairs = _.uniqBy(rawPairs, p => 
                    p.source_name === targetInd ? p.target_name : p.source_name
                  ).slice(0, 5);

                  if (displayPairs.length > 0) {
                    return (
                      <div className="bg-blue-50 p-4 rounded-r-lg shadow-sm">                        
                        <p className="text-xs text-blue-700 leading-relaxed mb-3">
                          你在做 
                          <span className="inline-block px-2 py-0.5 mx-1 bg-blue-100 text-blue-800 font-bold rounded shadow-sm border border-blue-200">
                            {targetInd}
                          </span>
                          如果覺得有點難，可能是因為下面這幾個單元也還沒完全弄懂喔：
                        </p>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {displayPairs.map((pair, i) => {                          
                            const targetName = pair.source_name === targetInd ? pair.target_name : pair.source_name;
                            return (
                              <div key={i} className="flex items-center justify-between bg-white/80 p-2 rounded border border-blue-100 hover:border-blue-400 transition cursor-pointer"
                                onClick={() => setSelectedIndicators([targetInd, targetName])}
                                title="點擊以進行疊加比較分析"
                              >
                                <span className="text-xs font-medium text-slate-700 hover:text-blue-600 underline decoration-blue-200 decoration-dashed underline-offset-4">{targetName}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold">
                                  關聯性 {Math.round(pair.correlation_score * 100)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-blue-500 mt-3 text-right">
                          點擊上方方塊，立即畫出軌跡比較圖！
                        </p>
                      </div>
                    );
                  } else {
                    return (
                      <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-4 rounded-xl text-center">
                        <p className="text-sm font-bold text-slate-600 mb-1">暫無關聯弱點</p>
                        <p className="text-xs text-slate-500">
                          在你目前練習過的知識節點中，沒有發現與 <b>{targetInd}</b> 有明顯關聯的學習困難。<br/>
                          建議你可以再練習一次 ，或嘗試挑戰其他新的知識節點。
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            ) : (              
              <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                <p className="text-xs text-slate-500 font-medium">點擊下方熱點方格，啟動多指標疊加分析</p>
              </div>
            )}

            <div className="flex justify-center border-t border-slate-100 pt-2">
              <button 
                onClick={() => setShowHeatmap(!showHeatmap)}
                className="text-[11px] text-slate-400 hover:text-blue-500 flex items-center gap-1 transition-colors px-3 py-1 rounded-full hover:bg-slate-50"
              >
                {showHeatmap ? "收起熱點圖 ▲" : "打開熱點圖 ▼"}
              </button>
            </div>

            {/* 核心點擊連動修改：點擊方塊觸發多指標選擇 */}
            {showHeatmap && (
              <div className="h-[300px] w-full bg-white">
                <Plot
                  onClick={(e) => {
                    if (!e.points || e.points.length === 0) return;                
                    const yLabel = (e.points[0].customdata as any)[0]; // target
                    const xLabel = (e.points[0].customdata as any)[1]; // source
                    if (yLabel && xLabel) {
                      if (yLabel === xLabel) {
                        setSelectedIndicators([yLabel]);
                      } else {
                        setSelectedIndicators([yLabel, xLabel]);
                      }
                      window.scrollTo({ top: 0, behavior: "smooth" }); // 自動捲動到最上方看疊加圖
                    }
                  }}
                  data={[{
                    z: assocHeatmapData?.z ?? [], x: assocHeatmapData?.x ?? [], y: assocHeatmapData?.y ?? [],
                    type: "heatmap",
                    colorscale: [[0, '#f8fafc'], [0.3, '#fee2e2'], [0.6, '#ef4444'], [1, '#991b1b']],
                    zmin: 0, zmax: 1, xgap: 2, ygap: 2,
                    customdata: assocHeatmapData?.z.map((row, i) => row.map((_, j) => [assocHeatmapData.customY[i], assocHeatmapData.customX[j]])) ?? [],
                    hovertemplate: "%{customdata[0]} <br>%{customdata[1]} <br>常常會一起錯喔！(點擊畫出比較圖)<extra></extra>",
                    hoverlabel: { align: "left" }, showscale: false, 
                  }]}
                  layout={{
                    autosize: true, margin: { t: 10, l: 80, r: 10, b: 100 },
                    xaxis: { tickangle: -45, tickfont: { size: 10, color: '#64748b' }, fixedrange: true },
                    yaxis: { autorange: "reversed", tickfont: { size: 10, color: '#64748b' }, fixedrange: true },
                    hovermode: "closest", plot_bgcolor: "rgba(0,0,0,0)", paper_bgcolor: "rgba(0,0,0,0)",
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%", height: "100%", cursor: "pointer" }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* ===== 圖表 1：知識節點練習次數圖 ===== */}
        <Card className="col-span-1 relative">

          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}
          
          <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
            <div className="flex flex-col gap-1">
            <CardTitle 
              className="text-xl font-bold cursor-pointer hover:opacity-70 transition flex items-center gap-2 group"
              onClick={() => setSelectedIndicators([])}
              title="點擊可清除所有指標篩選"
            >
              知識節點練習次數
            </CardTitle>
            
              {selectedIndicators.length === 0 && (
                <span className="text-[11px] text-slate-400 font-normal">
                  點擊下方長條圖，可選擇單一指標連動
                </span>
              )}
            </div>

            <div className="flex items-center gap-0">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f5f4fb] shadow-xl border-slate-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-blue-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li><b>練習次數：</b>學生在該指標上的投入總量。</li>
                          <li><b>平均正確率：</b>學生對該指標的理解程度。</li>
                          <li><b>該校平均線：</b>全校學生在該指標的平均正確率。</li>
                        </ul>
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <button
                onClick={() => runAIForChart("indicator_effect")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition shadow-sm"
              >
                <Bot className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>

          <CardContent className="h-[300px] w-full p-0 pb-2">
            <div className="w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar">
              <div
                style={{
                  width: chart1Data.xShort.length > 10 ? `${(chart1Data.xShort.length / 10) * 45}%` : '100%',
                  height: '100%',
                  minWidth: '100%',
                }}
              >
                <Plot
                  onClick={(e) => {
                    if (e.points && e.points.length > 0) {
                      setSelectedIndicators([e.points[0].customdata as string]);
                    }
                  }}
                  data={[
                    {
                      x: chart1Data.xShort, 
                      y: chart1Data.yBar,
                      type: "bar",
                      name: "練習次數",
                      marker: { 
                        color: chart1Data.xFull.map(name => 
                          selectedIndicators.length === 0 || selectedIndicators.includes(name) ? "#bfdbfe" : "#f1f5f9"
                        ) 
                      },
                      customdata: chart1Data.xFull, 
                      hovertemplate: "<b>%{x}</b><br><b>%{customdata}</b><br>練習次數：%{y}<extra></extra>",
                    },
                    {
                      x: chart1Data.xShort,
                      y: chart1Data.yLine,
                      type: "scatter",
                      mode: "lines+markers",
                      name: "平均正確率 (%)",
                      yaxis: "y2",
                      marker: { 
                        size: 8,
                        color: chart1Data.xFull.map(name => 
                          selectedIndicators.length === 0 || selectedIndicators.includes(name) ? "#2563eb" : "#cbd5e1"
                        )
                      },
                      line: { width: 3, color: "#94a3b8" },
                      hovertemplate: "<b>%{customdata}</b><br>平均正確率：%{y}%<extra></extra>",
                      customdata: chart1Data.xFull,
                    },
                  ]}
                  layout={{
                    autosize: true, 
                    margin: { t: 60, r: 40, b: 80, l: 50 },
                    xaxis: { 
                      title: { text: "知識節點", font: { size: 10, color: '#64748b' }, standoff: 15 },
                      tickangle: -30, 
                      tickfont: { size: 9 },
                      fixedrange: true
                    },
                    yaxis: {                       
                      title: { text: "練習次數", font: { size: 10, color: '#64748b' }, standoff: 15 },
                      gridcolor: "#f1f5f9", 
                      zeroline: false,
                      fixedrange: true 
                    },
                    yaxis2: {
                      title: { text: "平均正確率 (%)", font: { size: 10, color: '#64748b' }, standoff: 15 },
                      overlaying: "y", side: "right", range: [0, 110], showgrid: false, fixedrange: true 
                    },
                    hovermode: "closest",
                    shapes: avgScoreCompare.classAvg !== null ? [{
                        type: "line", xref: "paper", x0: 0, x1: 1, yref: "y2", y0: avgScoreCompare.classAvg, y1: avgScoreCompare.classAvg,
                        line: { color: "#ef4444", width: 2, dash: "dash" },
                      }] : [],
                    annotations: avgScoreCompare.classAvg !== null ? [{
                        xref: "paper", x: 1, yref: "y2", y: avgScoreCompare.classAvg,
                        text: `校平均 ${avgScoreCompare.classAvg}%`,
                        showarrow: false, font: { size: 11, color: "#ef4444" },
                        xanchor: "right", yanchor: "bottom",
                      }] : [],
                    legend: { orientation: "h", yanchor: "bottom", y: 1.1, xanchor: "center", x: 0.5, font: { size: 11 } },
                  }}
                  useResizeHandler
                  style={{ width: "100%", height: "100%", cursor: "pointer" }}
                  config={{ displayModeBar: false, responsive: true }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart 3: 差距條形圖 */}
        <Card className="col-span-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
            <div className="flex flex-col gap-1">
              <CardTitle 
              className="text-xl font-bold cursor-pointer hover:opacity-70 transition flex items-center gap-2 group"
              onClick={() => setSelectedIndicators([])}
              title="點擊可清除指標篩選"
            >
              與全校平均的差距
            </CardTitle>

            {selectedIndicators.length === 0 && (
                <span className="text-[11px] text-slate-400 font-normal">
                  點擊下方長條圖，可查看單一指標連動表現
                </span>
              )}
              </div>
              
              <div className="flex items-center gap-0">
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                      <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f5f4fb] shadow-xl border-slate-200 text-slate-700 z-50">
                        <div className="space-y-3">
                          <p className="font-bold border-b pb-1 text-blue-700">圖表計算說明：</p>
                          <ul className="text-xs space-y-2 list-disc pl-4">
                            <li><b>中間基準線 (0%)：</b>代表全校同學的平均分。</li>
                            <li><b>學生表現：</b>採用你對該指標<b>「最後一次練習」</b>的成績計算。</li>
                          </ul>
                        </div>
                      </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <button
                  onClick={() => runAIForChart("indicator_gap")}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition shadow-sm"
                >
                  <Bot className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
          <CardContent className="p-0"> 
            <div className="h-[300px] overflow-y-auto overflow-x-hidden custom-scrollbar">
              <Plot
                onClick={(e) => {
                  if (e.points && e.points.length > 0) {
                    setSelectedIndicators([(e.points[0].customdata as any)[0]]);
                  }
                }}
                data={[
                  {
                    type: "bar", orientation: "h",
                    x: diffBarData.map(d => d.latestDiff),
                    y: diffBarData.map(d => d.indicator),
                    marker: {
                      color: diffBarData.map(d => {
                        const isSelected = selectedIndicators.length === 0 || selectedIndicators.includes(d.original_name);
                        if (d.latestDiff >= 0) return isSelected ? "#16a34a" : "rgba(218, 248, 227, 0.5)"; 
                        return isSelected ? "#dc2626" : "rgba(252, 220, 220, 0.5)"; 
                      }),
                    },
                    text: diffBarData.map(d => `${d.latestDiff >= 0 ? "+" : ""}${d.latestDiff}%`),
                    textposition: "inside",
                    customdata: diffBarData.map(d => [ d.original_name, d.latestScore, d.classAvg, d.indicate_name ]),
                    hovertemplate:
                    "<b>%{y} - %{customdata[3]}</b><br>" +
                    "最新表現：%{customdata[1]}%<br>" +
                    "全校平均：%{customdata[2]}%<br>" +
                    "目前差距：%{x}%<extra></extra>",
                  },
                ]}
                layout={{
                height: Math.max(300, diffBarData.length * 25), 
                autosize: true, margin: { l: 120, r: 50, t: 65, b: 80 }, showlegend: false,
                xaxis: { title: { text: "與校平均差距（%）", font: { size: 10, color: '#64748b' }, standoff: 15 }, zeroline: true, zerolinewidth: 2, zerolinecolor: "#94a3b8", side: "top", fixedrange: true },
                yaxis: { title: { text: "知識節點", font: { size: 10, color: '#64748b' }, standoff: 15 }, automargin: true, fixedrange: true },
                shapes: [{ type: "line", x0: 0, x1: 0, yref: "paper", y0: 0, y1: 1, line: { color: "#475569", width: 2, dash: "dash" } }],
                annotations: [{ x: 0, y: 1.07, yref: "paper", text: "校平均", showarrow: false, font: { size: 11, color: "#64748b", weight: "bold" }, xanchor: "center" }],
                font: { family: "inherit" },
              }}
              config={{ displayModeBar: false, responsive: true, staticPlot: false }}
              style={{ width: "100%", cursor: "pointer" }}
            />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ===== 練習投入走勢圖 ===== */}
            <Card className="col-span-1 relative">
              {loading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                  <Activity className="animate-spin mr-2 w-4 h-4" />
                  <span className="text-sm text-slate-600">資料分析中...</span>
                </div>
              )}
    
                <CardHeader className="flex flex-row items-center justify-between py-4 pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  練習時間走勢
                 
                </CardTitle>
    
                <div className="flex items-center gap-1">
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                        <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f8fafc] shadow-2xl border-blue-200 text-slate-700 z-50">
                          <div className="space-y-3">
                            <p className="font-bold border-b pb-1 text-blue-700">圖表計算說明：</p>
                            <ul className="text-xs space-y-2 list-disc pl-4">
                              <li>
                                  <b className="text-blue-700 font-bold">單次作答時間：</b> 
                                  顯示你在該知識節點下，每次練習所耗費的總秒數。時間縮短通常代表對知識點的熟練度逐漸提升。
                                </li>
                                <li>
                                  <b className="text-rose-600 font-bold">關聯弱點比較：</b> 
                                  當你在「弱點關聯圖」選取多個指標時，此處將疊加顯示時間折線，幫助你直觀比較自己在連動觀念中，究竟在哪個環節卡最久。
                                </li>
                              </ul>
                              <p className="text-[12px] text-slate-400 pt-1 border-t">
                                ※ 透過此圖可檢視作答流暢性：若正確率高但花費時間極長，代表該觀念可能尚未完全內化，建議持續練習以提升反應速度！
                              </p>
                          </div>
                        </TooltipContent>                   
                    </Tooltip>
                  </TooltipProvider>
    
                  <button
                    onClick={() => runAIForChart("practice_trend")}
                    className="flex items-center justify-center w-8 h-8 rounded-full text-blue-500 hover:bg-blue-50 transition"
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
                
              <CardContent className="h-[350px] w-full">
                <Plot
                  data={trendPlotData.practice.map(trace => {
                      if (trace.type === 'scatter') {
                        return {
                          ...trace,
                          marker: {
                            ...trace.marker, 
                            size: 15,                  
                          }
                        };
                      }
                      return trace;
                    })}
                  layout={{
                    height: 350,
                    margin: { t: 10, l: 60, r: 20, b: 120 },
                    xaxis: { 
                      title: { text: "練習時間點", font: { size: 12, color: '#64748b' }, standoff: 15 },
                      type: "category", 
                      categoryorder: "array",
                      categoryarray: trendPlotData.dates,
                      tickangle: -20, 
                      tickfont: { size: 10 } 
                    },
                    yaxis: { 
                      title: { text: "花費時間 (秒)", font: { size: 12, color: '#64748b' }, standoff: 15 }, side: "left", showgrid: true },
                    legend: { orientation: "h", y: -0.3, x: 0.5, xanchor: "center" },
                    hovermode: "closest",
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%", height: "100%" }}
                />
              </CardContent>
            </Card>
    
            {/* ===== 正確率走勢圖 ===== */}
            <Card className="col-span-1 relative">
              {loading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                  <Activity className="animate-spin mr-2 w-4 h-4" />
                  <span className="text-sm text-slate-600">資料分析中...</span>
                </div>
              )}
    
              <CardHeader className="flex flex-row items-center justify-between py-4 pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  正確率走勢
                  
                </CardTitle>
    
                <div className="flex items-center gap-1">
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                        <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f8fafc] shadow-2xl border-blue-200 text-slate-700 z-50">
                          <div className="space-y-3">
                            <p className="font-bold border-b pb-1 text-blue-700">圖表計算說明：</p>
                            <ul className="text-xs space-y-2 list-disc pl-4">
                              <li>
                                <b className="text-blue-700 font-bold">單一指標正確率：</b> 
                                顯示你在特定知識節點下，歷次練習的答對率變化，幫助追蹤學習成效是否穩定成長。
                              </li>
                              <li>
                                <b className="text-rose-600 font-bold">關聯弱點比較：</b> 
                                當你在其他圖表（如弱點關聯圖）選擇多個指標時，此處將疊加顯示這些指標的正確率折線，方便比對不同觀念間的掌握落差。
                              </li>
                            </ul>
                            <p className="text-[12px] text-slate-400 pt-1 border-t">
                              ※ 透過此圖可以觀察連動關係：當你的核心弱點（指標 A）正確率提升時，其關聯弱點（指標 B）是否也隨之進步。
                            </p>                       
                          </div>
                        </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
    
                  <button
                    onClick={() => runAIForChart("score_trend")}
                    className="flex items-center justify-center w-8 h-8 rounded-full text-blue-500 hover:bg-blue-50 transition"
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              
              <CardContent className="h-[350px] w-full">
                <Plot
                  data={trendPlotData.score.map(trace => {
                      if (trace.type === 'scatter') {
                        return {
                          ...trace,
                          marker: {
                            ...trace.marker, 
                            size: 15,                  
                          }
                        };
                      }
                      return trace;
                    })}
                  layout={{
                    height: 350,
                    margin: { t: 40, l: 60, r: 30, b: 110 },
                    xaxis: { 
                      title: { text: "練習時間點", font: { size: 12, color: '#64748b' }, standoff: 15 },
                        type: "category",                       
                        categoryorder: "array",
                        categoryarray: trendPlotData.dates,
                        tickangle: -20, 
                        tickfont: { size: 10 }
                    },
                    yaxis: { 
                      title: { text: "正確率 (%)", font: { size: 12, color: '#64748b' }, standoff: 15 }, 
                      side: "left", showgrid: true, range: [-5, 105], ticksuffix: "%"  },
                    legend: { orientation: "h", y: -0.3, x: 0.5, xanchor: "center" },
                    hovermode: "closest",
                  }}
                  style={{ width: "100%", height: "100%" }}
                  config={{ displayModeBar: false, responsive: true }}
                />
              </CardContent>
            </Card>
          </div>

      
      

      {/* ===== 學習歷程表現圖 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
      <Card className="col-span-1 relative">

        {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

        <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
          <div className="flex flex-col gap-1">
          <CardTitle 
            className="text-xl font-bold cursor-pointer hover:opacity-70 transition flex items-center gap-2 group flex-wrap"
            onClick={() => setSelectedIndicators([])}
          >
            學習歷程表現
            
          </CardTitle>

          {selectedIndicators.length === 0 && (
                <span className="text-[11px] text-slate-400 font-normal">
                  點擊圖表中的圓點，可查看單一指標的軌跡表現
                </span>
              )}
          </div> 

            <div className="flex items-center gap-0">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f5f4fb] shadow-xl border-slate-200 text-slate-700 z-50">
                    <div className="space-y-3">
                      <p className="font-bold border-b pb-1 text-blue-700">圖表計算說明：</p>
                      <ul className="text-xs space-y-2 list-disc pl-4">
                        <li><b>圓點：</b>學生在單元上的練習紀錄。</li>
                        <li><b>答題速度（X軸）：</b>往左代表思考愈快，往右代表花比較多時間。</li>
                        <li><b>正確率 (Y軸)：</b>愈往上代表答對率越高，表現越好。</li>
                        <li><b>點擊互動：</b>點擊圓點可以查看該單元的「歷史進步軌跡」。多選比較時會畫出多條知識學習的軌跡線！</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <button
                onClick={() => runAIForChart("learning_process")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition shadow-sm"
              >
                <Bot className="w-4 h-4" />
              </button>
            </div>
        </CardHeader>
        <CardContent className="h-[300px]">
          <Plot
            onClick={(data) => {
              if (chart3Data.mode === "overview" && data.points.length > 0) {
                setSelectedIndicators([data.points[0].text as string]);
              }
            }}
            data={chart3Data.traces}
            layout={{
              height: 300,
              margin: { t: 20, r: 20, b: 70, l: 40 }, 
              xaxis: { title: { text: "平均每題作答時間（秒）", font: { size: 10, color: '#64748b' }, standoff: 15 },  gridcolor: "#f1f5f9", zeroline: false },
              yaxis: { title: { text: "正確率 (%)", font: { size: 10, color: '#64748b' }, standoff: 15 }, range: [-5, 115], tickformat: ",.0f", gridcolor: "#f1f5f9" },
              shapes: [
                { type: "line", x0: 0, x1: 1, xref: "paper", y0: chart3Data.passScore, y1: chart3Data.passScore, line: { color: "#94a3b8", width: 1, dash: "dot" } },
                { type: "line", x0: chart3Data.medianTimeSec, x1: chart3Data.medianTimeSec, y0: 0, y1: 100, line: { color: "#94a3b8", width: 1, dash: "dot" } },
              ],
              annotations: [
                { x: chart3Data.medianTimeSec * 0.6, y: 85, text: "<b>精熟區</b>", showarrow: false, font: { color: "#22c55e" } },
                { x: chart3Data.medianTimeSec * 1.4, y: 85, text: "<b>穩定區</b>", showarrow: false, font: { color: "#3b82f6" } },
                { x: chart3Data.medianTimeSec * 0.6, y: 20, text: "<b>猜測區</b>", showarrow: false, font: { color: "#f97316" } },
                { x: chart3Data.medianTimeSec * 1.4, y: 20, text: "<b>卡關區</b>", showarrow: false, font: { color: "#ef4444" } },
              ],
              showlegend: selectedIndicators.length > 0, 
              legend: { orientation: "h", y: -0.3, x: 0.5, xanchor: "center" },
              hovermode: "closest",
            }}
            useResizeHandler
            style={{ width: "100%", height: "100%", cursor: chart3Data.mode === "overview" ? "pointer" : "default" }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </CardContent>
      </Card>
      </div>

       
        {/* ===== 詳細練習紀錄  ===== */}
        <Card className="col-span-1 shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-col md:flex-row md:items-center py-4 pb-2 gap-4">
            <CardTitle className="text-xl font-bold text-slate-700 flex items-center gap-2">
              詳細練習紀錄 
              <span className="text-xs text-blue-600">（ 科目：{selectedSubject}）</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0 pt-2">
            <div className="max-h-[350px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-xs text-slate-500 border-b">
                    <th className="p-3 px-4">練習日期</th>
                    
                    {/* 移除條件判斷，讓知識節點欄位常駐顯示 */}
                    <th className="p-3 px-4 min-w-[20px]">知識節點</th>
                    
                    {Array.from({ length: maxItemCount }).map((_, i) => (
                      <th key={i} className="p-3 text-center">題目{i + 1}</th>
                    ))}
                    <th className="p-3 text-center">花費時間(秒)</th>
                    <th className="p-3 text-center">正確率</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedRows.length > 0 ? (
                    detailedRows.map((row) => (
                      <tr key={row.prac_answer_sn} className="border-t hover:bg-slate-50/50 transition">
                        <td className="px-4 py-2 font-mono text-xs text-slate-600">
                          {formatDateTime(row.date)}
                        </td>
                        
                        {/* 移除條件判斷，直接渲染知識節點名稱 */}
                        <td className="px-3 py-2 text-xs text-slate-600 font-mono">
                          {row.items[0]?.indicate_name || "—"}
                        </td>
                        
                        {Array.from({ length: maxItemCount }).map((_, i) => {
                          const item = row.items[i];
                          return (
                            <td key={i} className="text-center">
                              {item ? (item.is_correct ? <span className="text-green-500 font-bold">✔</span> : <span className="text-red-500 font-bold">✘</span>) : <span className="text-slate-300">—</span>}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center text-xs font-medium text-slate-600">
                          {row.avg_item_time_ms > 0 ? row.avg_item_time_ms.toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.score_rate >= 80 ? "bg-green-100 text-green-700" : row.score_rate < 60 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {Math.round(row.score_rate)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={maxItemCount + 4} className="text-center py-8 text-slate-400">尚無符合條件的作答紀錄</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}