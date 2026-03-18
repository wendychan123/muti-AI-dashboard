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

type ExplainTarget =
  | "daily_overview"    
  | "practice_trend"    
  | "score_trend"       
  | "indicator_effect"  
  | "learning_process"  
  | "indicator_gap"
  | "progress_trend";    

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
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");

  // Filters
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

  // 核心連動狀態：合併原有的 drilldownIndicator 與 detailIndicator
  const [selectedIndicator, setSelectedIndicator] = useState<string>("all");

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

      const [DailyRes, attemptsRes, indicatorRes, OrgIndicatorRes, items] =
        await Promise.all([setDailyReq, attemptsReq, indicatorReq, OrgIndicatorReq, itemsReq]);

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

  // 詳細記錄表格，根據全域 selectedIndicator 過濾
  const filteredPracItems = useMemo<PracItemRow[]>(() => {
    if (selectedIndicator === "all") return subjectPracItems;
    return subjectPracItems.filter(i => i.indicate_name === selectedIndicator);
  }, [subjectPracItems, selectedIndicator]);

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

    Object.values(attemptsByIndicator).forEach((attempts) => {
      const sorted = _.orderBy(attempts, ["date", "id"], ["asc", "asc"]);
      if (!sorted.length) return;
      const latest = sorted[sorted.length - 1];
      const latestScore = Number(latest.score_rate);
      const everLow = sorted.some(a => (Number(a.score_rate) > 1 ? Number(a.score_rate) < 60 : Number(a.score_rate) < 0.6));
      const isLatestPerfect = latestScore === 100 || latestScore >= 0.99;

      if (isLatestPerfect) {
        if (everLow) improvedCount++; 
        else perfectCount++;  
      }
      if (latestScore > 1 ? latestScore < 60 : latestScore < 0.6) struggleCount++;
    });

    return {
      count: unitCount,          
      userCount,          
      schoolAvgCount,
      totalTime,                 
      schoolAvgTotalTime,        
      timeDiff,                  
      avgScore: Math.round(avgScore * 100),
      avgSpeedSec,
      struggleCount,
      improvedCount,
      perfectCount,
      reachedGoal: struggleCount === 0 && (improvedCount > 0 || perfectCount > 0),
    };
  }, [filteredAttempts, OrgIndicatorData, selectedSubject]);

  const belowClassAvgStats = useMemo(() => {
    if (!filteredAttempts.length) return { count: 0, classPracPeople: null };
    const attemptsByIndicator = _.groupBy(filteredAttempts, "indicate_name");
    let struggleCount = 0;
    Object.values(attemptsByIndicator).forEach((attempts: AttemptRow[]) => {
      const hasPerfectRecord = attempts.some(a => (a.score_rate >= 0.99 && a.score_rate <= 1) || a.score_rate === 100);
      if (!hasPerfectRecord) struggleCount++;
    });
    const classPracPeople = OrgIndicatorData.length > 0 ? Math.max(...OrgIndicatorData.map(c => c.participant_count || 0)) : null;
    return { count: struggleCount, classPracPeople };
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

  // 圖表一：Pareto (Bar + Line)
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

  // 🔥 圖表二：學習歷程表現圖 (連動 selectedIndicator)
  const chart3Data = useMemo(() => {
    if (!filteredAttempts.length) return { mode: "overview", x: [], y: [], text: [], zone: [], itemsCount: [], medianTimeSec: 5, passScore: 60 };
    const passScore = 60;
    const zoneOf = (acc: number, timeSec: number, median: number) => {
      if (acc >= passScore && timeSec <= median) return "精熟區";
      if (acc >= passScore && timeSec > median) return "穩定區";
      if (acc < passScore && timeSec <= median) return "猜測區";
      return "卡關區";
    };

    if (selectedIndicator === "all") {
      // 模式 A：總覽模式
      const attemptsByIndicator = _.groupBy(filteredAttempts, "indicate_name");
      const latestAttempts = Object.values(attemptsByIndicator).map(attempts => {
        const sorted = _.orderBy(attempts, ["date", "prac_answer_sn"], ["asc", "asc"]);
        const latest = sorted[sorted.length - 1];
        return { ...latest, avg_item_time_sec: latest.items_count > 0 ? latest.during_time / latest.items_count : 0 };
      }).filter(a => a.items_count > 0);

      const timeSecValues = latestAttempts.map(d => d.avg_item_time_sec);
      const medianTimeSec = calculateMedian(timeSecValues) || 5;

      return {
        mode: "overview",
        x: latestAttempts.map(d => d.avg_item_time_sec),
        y: latestAttempts.map(d => d.score_rate),
        text: latestAttempts.map(d => d.indicate_name),
        zone: latestAttempts.map(d => zoneOf(d.score_rate, d.avg_item_time_sec, medianTimeSec)),
        itemsCount: latestAttempts.map(d => d.items_count),
        medianTimeSec,
        passScore,
      };
    } else {
      // 模式 B：詳細歷程模式
      const specificAttempts = filteredAttempts.filter(a => a.indicate_name === selectedIndicator);
      const sorted = _.orderBy(specificAttempts, ["date", "prac_answer_sn"], ["asc", "asc"]);
      const validPoints = sorted.map((a, idx) => ({
        ...a, attemptIndex: idx + 1, isLatest: idx === sorted.length - 1,
        avg_item_time_sec: a.items_count > 0 ? a.during_time / a.items_count : 0,
      })).filter(a => a.items_count > 0);

      const timeSecValues = validPoints.map(d => d.avg_item_time_sec);
      const medianTimeSec = calculateMedian(timeSecValues) || 5;

      return {
        mode: "detail",
        x: validPoints.map(d => d.avg_item_time_sec),
        y: validPoints.map(d => d.score_rate),
        text: validPoints.map(d => String(d.attemptIndex)),
        isLatest: validPoints.map(d => d.isLatest),
        zone: validPoints.map(d => zoneOf(d.score_rate, d.avg_item_time_sec, medianTimeSec)),
        itemsCount: validPoints.map(d => d.items_count),
        medianTimeSec,
        passScore,
      };
    }
  }, [filteredAttempts, selectedIndicator]);

  const ZONE_COLOR: Record<string, string> = {
    精熟區: "#22c55e", 穩定區: "#3b82f6", 猜測區: "#f97316", 卡關區: "#ef4444",
  };

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

  // 圖表三：差距條形圖資料
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
     練習投入與學習成效走勢
  ========================= */
  const trendData = useMemo(() => {
    const rawData = (attemptsData || []) as AttemptRow[];
    const filtered: AttemptRow[] = rawData.filter((d) => selectedSubject === "all" || d.subject_name === selectedSubject);
    if (filtered.length === 0) return [];

    const grouped = _.groupBy(filtered, (r) => {
      const d = dayjs(r.date);
      if (viewMode === "day") return d.format("YYYY-MM-DD");
      if (viewMode === "week") return d.startOf("week").format("YYYY-MM-DD");
      return d.startOf("month").format("YYYY-MM-DD");
    });

    return Object.entries(grouped).map(([date, rows]) => {
      const currentRows = rows as AttemptRow[];
      const totalPrac = currentRows.length;
      const totalTimeMin = _.sumBy(currentRows, "during_time") / 60;
      const totalItems = _.sumBy(currentRows, "items_count");
      const weightScoreSum = _.sumBy(currentRows, (r) => (r.score_rate || 0) * (r.items_count || 0));
      return { date, totalPrac, totalTimeMin: Math.round(totalTimeMin * 10) / 10, avgScore: totalItems > 0 ? Math.round(weightScoreSum / totalItems) : 0 };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [attemptsData, viewMode, selectedSubject]);

  
  /* =========================
    進步幅度分析圖 
  ========================= */
  const progressTrendData = useMemo(() => {
    if (!filteredAttempts.length) return null;

    const targetAttempts = selectedIndicator === "all" 
      ? filteredAttempts 
      : filteredAttempts.filter(d => d.indicate_name === selectedIndicator);

    const sorted = _.orderBy(targetAttempts, ["date"], ["asc"]);
    const valid = sorted.filter(d => d.accuracy_diff !== null && d.accuracy_diff !== undefined);

    return {
      x: valid.map(d => d.date),
      y: valid.map(d => d.accuracy_diff),
      colors: valid.map(d => (d.accuracy_diff ?? 0) >= 0 ? "#22c55e" : "#ef4444"),
      // 🔥 核心修改：把圖表需要的所有額外資訊打包成一個陣列傳遞
      customdata: valid.map(d => [
        d.indicate_name,                   // customdata[0]
        d.during_time,                     // customdata[1]
        d.learning_pattern ?? "未分類"      // customdata[2]
      ]),
    };
  }, [filteredAttempts, selectedIndicator]);


  /* =========================
     AI 助手
  ========================= */
  const runAIForChart = async (chart: ExplainTarget) => {
    setGeminiLoading(true);
  
    const prompt = buildStudentPracPrompt({
      date: selectedDate,
      subject: selectedSubject,
      selectedIndicator: selectedIndicator,
      selectedCharts: [chart],   //只分析一張
      stats: {
        avgScore: avgScoreCompare.studentAvg,
        avgSpeedSec: Number(processedStats.avgSpeedSec),
        totalCount: processedStats.count,
        belowClassCount: belowClassAvgStats.count,
        reachedGoal: processedStats.reachedGoal,
      },
  
      chartData: {
        practiceTrend: trendData, 
        scoreTrend: trendData,
        indicatorEffect: chart1Data.meta,
        learningProcess: chart3Data,
        indicatorGap: diffBarData,
        progressTrend: progressTrendData
        
      }
    });
  
    window.dispatchEvent(
      new CustomEvent("student-ai-update", {
        detail: { 
          loading: true,
          questions: [EXPLAIN_LABEL_MAP[chart]], }
      })
    );
  
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        prompt,
        role: "student",
     }),
     
  
    });
  
    const data = await res.json();
  
    setGeminiResult(data.text);
    setShowAI(true);
    setGeminiLoading(false);
  
    window.dispatchEvent(
      new CustomEvent("student-ai-update", {
        detail: {
          loading: false,
          content: data.text,
        },
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
  
      // 中文轉 ExplainTarget
      const explainTargets: ExplainTarget[] = chartLabels
        .map(label => LABEL_TO_EXPLAIN_KEY[label])
        .filter(Boolean);
  
      if (explainTargets.length === 0) return;
  
      setGeminiLoading(true);
  
      // 組合多圖 prompt
      const prompt = buildStudentPracPrompt({
        date: selectedDate,
        subject: selectedSubject,
        selectedIndicator: selectedIndicator,
        selectedCharts: explainTargets, // ← 多圖
        stats: {
          avgScore: avgScoreCompare.studentAvg,
          avgSpeedSec: Number(processedStats.avgSpeedSec),
          totalCount: processedStats.count,
          belowClassCount: belowClassAvgStats.count,
          reachedGoal: processedStats.reachedGoal,
        },
  
        chartData: {
            practiceTrend: trendData, 
            scoreTrend: trendData,
            indicatorEffect: chart1Data.meta,
            learningProcess: chart3Data,
            indicatorGap: diffBarData,
            progressTrend: progressTrendData
          }
      });
  
      // 發送 loading 給 panel
      window.dispatchEvent(
        new CustomEvent("student-ai-update", {
          detail: {
            loading: true,
            questions: chartLabels,
          },
        })
      );
  
      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            role: "student",
          }),
        });
  
        const data = await res.json();
  
        setGeminiResult(data.text);
        setShowAI(true);
        setGeminiLoading(false);
  
        // 回傳結果給 Panel
        window.dispatchEvent(
          new CustomEvent("student-ai-update", {
            detail: {
              loading: false,
              content: data.text,
            },
          })
        );
      } catch (err) {
        console.error("Multi AI error:", err);
        setGeminiLoading(false);
      }
    };
  
    window.addEventListener("student-ai-multi-request", handler);
  
    return () => {
      window.removeEventListener("student-ai-multi-request", handler);
    };
  }, [
    trendData,
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
    {
      key: "daily_overview",
      label: "總覽練習概況",
      description: "總覽投入時間與正確率變化",
    },
    {
      key: "indicator_effect",
      label: "能力指標投入",
      description: "各能力指標的練習次數與表現",
    },
    {
      key: "learning_process",
      label: "學習歷程表現",
      description: "答題速度 × 正確率的學習區域",
    },
    {
      key: "indicator_gap",
      label: "能力指標差距",
      description: "學生與該校平均的差距",
    },
    {
      key: "practice_trend",
      label: "練習投入走勢",
      description: "分析練習時間與次數的規律性",
    },
    {
      key: "score_trend",
      label: "學習成效走勢",
      description: "分析正確率隨時間進步的幅度",
    },
    {
      key: "progress_trend",
      label: "進步幅度變化",
      description: "分析多次練習間的正確率變化與學習狀態",
    },
  ];
  
  const EXPLAIN_LABEL_MAP: Record<ExplainTarget, string> =
    Object.fromEntries(
      EXPLAIN_CHART_OPTIONS.map(opt => [opt.key, opt.label])
    ) as Record<ExplainTarget, string>;
  
  
  const LABEL_TO_EXPLAIN_KEY: Record<string, ExplainTarget> = {
    "練習狀況表現": "daily_overview",
    "練習投入走勢": "practice_trend",
    "學習成效走勢": "score_trend",
    "能力指標投入": "indicator_effect",
    "學習歷程表現": "learning_process",
    "能力指標差距": "indicator_gap",
    "進步幅度變化": "progress_trend",
  };
  

  /* =========================
     Render
     ========================= */
  return (
    <div className="min-h-screen p-4 space-y-6">

      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 p-2 pb-1">
          <div className="p-2 text-slate-400"><Filter className="w-5 h-5"/></div>
          <span className="text-sm">科目：</span>
          <Select
            value={selectedSubject}
            onValueChange={(val) => {
              setSelectedSubject(val);
              setSelectedIndicator("all"); // 切換科目時重置連動狀態
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
            總練習單元數
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-3xl font-black text-slate-700 tracking-tight">
              {processedStats.count.toLocaleString()}
            </div>
            
          </div>
        </div>

        {/* KPI 2: 總投入時間 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            總投入時間
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-2xl font-black text-slate-700 tracking-tight">
              {Math.round(processedStats.totalTime / 60).toLocaleString()} <span className="text-base">分</span>
            </div>
            {processedStats.schoolAvgTotalTime != null && (
              <div className="text-[11px] text-center mt-1 font-medium">
                <span className="text-slate-500">校平均 {Math.round(processedStats.schoolAvgTotalTime / 60).toLocaleString()} 分</span><br/>
                <span className={`ml-1 ${
                  processedStats.timeDiff >= 0 ? "text-green-500" : "text-red-500"
                }`}>
                  {processedStats.timeDiff === 0 ? " (與校平均持平)" : 
                  processedStats.timeDiff > 0 
                  ? ` (+${Math.round(Math.abs(processedStats.timeDiff) / 60).toLocaleString()}分)` 
                  : ` (-${Math.round(Math.abs(processedStats.timeDiff) / 60).toLocaleString()}分)`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* KPI 3: 平均正確率 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            平均正確率
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-2xl font-black text-slate-700 tracking-tight">
              {avgScoreCompare.studentAvg} %
            </div>
            <div className="text-[11px] text-center text-slate-400 font-medium mt-1">
              <span className="text-slate-500">校平均 {avgScoreCompare.classAvg} % </span><br/>
              <span
                      className={
                        avgScoreCompare.diff >= 0
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      ({avgScoreCompare.diff >= 0 ? "+" : ""}
                      {avgScoreCompare.diff}%)
                    </span>
            </div>
          </div>
        </div>

        {/* KPI 4: 低於校平均 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            表現狀態
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className={`text-2xl font-black tracking-tight ${
              belowClassAvgStats.count > 0 ? "text-red-500" : "text-blue-600"
            }`}>
              {belowClassAvgStats.count > 0 ? "需加強" : "已滿分"}
            </div>
            <div className="text-[11px] text-slate-500 mt-2 text-center">
              {belowClassAvgStats.count > 0 
                ? `尚有 ${belowClassAvgStats.count} 項指標未達滿分` 
                : "已完成指標且滿分"}
            </div>
          </div>
        </div>

        {/* KPI 5：目標達成率 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            是否達成滿分
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className={`text-2xl font-black tracking-tight ${
              processedStats.reachedGoal ? "text-blue-600" : "text-red-500"
            }`}>
              {processedStats.reachedGoal ? "已達成" : "尚未達成"}
            </div>
            <div className="gap-2 mt-2 font-medium">
              <span className="text-[11px] bg-slate-100 px-1 rounded text-slate-500">克服弱點：{processedStats.improvedCount}</span><br/>
              <span className="text-[11px] bg-slate-100 px-1 rounded text-slate-500">初次精熟：{processedStats.perfectCount}</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Charts Grid */}
      {/* =========================
              區塊一（2張圖表）
      ========================= */}
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
                {/* 左側：標題 */}
                <CardTitle className="text-xl font-bold ">
                  練習投入走勢
                  <span className="px-2 text-xs text-blue-600">（ 科目：{selectedSubject}）</span>
                </CardTitle>
    
                {/* 右側：按鈕群組 */}
                <div className="flex items-center gap-1">
                  {/* 圖表說明 Tooltip */}
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                        className="
                            flex items-center justify-center
                            w-8 h-8
                            rounded-full
                            text-slate-400
                            hover:bg-slate-100
                            hover:text-slate-600
                            transition
                            "
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                        <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f8fafc] shadow-2xl border-blue-200 text-slate-700 z-50">
                          <div className="space-y-3">
                            <p className="font-bold border-b pb-1 text-blue-700">圖表計算說明：</p>
                            <ul className="text-xs space-y-2 list-disc pl-4">
                              <li>
                                <b className="text-blue-600">活躍學生數 (長條圖)：</b>
                                指該日/週/月班級內有實際進行作答的學生人數
                              </li>
                              <li>
                                <b className="text-blue-600">練習總次數 (折線圖)：</b>
                                全校學生完成練習題的累計總量。
                              </li>
                            </ul>
                              <p className="text-[12px] text-slate-400 pt-1 border-t">
                                ※ 透過此圖可觀察使用參與度與學習投入強度是否隨課程進度波動。
                              </p>
                          </div>
                        </TooltipContent>                    
                    </Tooltip>
                  </TooltipProvider>
    
                  {/* AI 分析按鈕 */}
                  <button
                    onClick={() => runAIForChart("practice_trend")}
                    className="
                      flex items-center justify-center
                      w-8 h-8
                      rounded-full
                      text-blue-500
                      hover:bg-blue-50
                      transition
                    "
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
    
    
              {/* 日 / 週 / 月 切換按鈕 */}
                <div className="flex items-center gap-1 mr-2 px-8">
                  {["day", "week", "month"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode as any)}
                      className={`px-3 py-1 text-xs rounded-md transition
                        ${
                          viewMode === mode
                            ? "bg-blue-600 text-white shadow"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                      {mode === "day" ? "日線" : mode === "week" ? "週線" : "月線"}
                    </button>
                  ))}
                </div>
                
    
              <CardContent className="h-[350px] w-full">
                <Plot
                  data={[
                    {
                      x: trendData.map(t => t.date),
                      y: trendData.map(t => t.totalTimeMin),
                      type: "bar",
                      name: "投入時間 (分)",
                      marker: { color: "rgba(59, 130, 246, 0.3)" }, // 藍色系
                      hovertemplate: "投入時間：%{y} 分鐘<extra></extra>",
                    },
                    {
                      x: trendData.map(t => t.date),
                      y: trendData.map(t => t.totalPrac),
                      type: "scatter",
                      mode: "lines+markers",
                      name: "練習次數",
                      line: { color: "#2563eb", width: 3 },
                      yaxis: "y2",
                      hovertemplate: "練習次數：%{y} 次<extra></extra>",
                    },
                  ]}
                  layout={{
                    height: 350,
                    margin: { t: 40, l: 50, r: 50, b: 80 },
                    xaxis: { type: "category", tickangle: -35, tickfont: { size: 10 } },
                    yaxis: { title: "投入時間 (分)", side: "left", showgrid: true },
                    yaxis2: { title: "練習次數", overlaying: "y", side: "right", showgrid: false },
                    legend: { orientation: "h", y: -0.3, x: 0.5, xanchor: "center" },
                    hovermode: "x unified",
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%", height: "100%" }}
                />
              </CardContent>
            </Card>
    
            {/* ===== 學習成效走勢圖 ===== */}
            <Card className="col-span-1 relative">
              {loading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                  <Activity className="animate-spin mr-2 w-4 h-4" />
                  <span className="text-sm text-slate-600">資料分析中...</span>
                </div>
              )}
    
              <CardHeader className="flex flex-row items-center justify-between py-4 pb-4">
                {/* 左側：標題 */}
                <CardTitle className="text-xl font-bold ">
                  學習成效走勢
                  <span className="px-2 text-xs text-blue-600">（ 科目：{selectedSubject} ）</span>
                </CardTitle>
    
                {/* 右側：按鈕群組 */}
                <div className="flex items-center gap-1">
                  {/* 圖表說明 Tooltip */}
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="
                            flex items-center justify-center
                            w-8 h-8
                            rounded-full
                            text-slate-400
                            hover:bg-slate-100
                            hover:text-slate-600
                            transition
                            "
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                        <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f8fafc] shadow-2xl border-blue-200 text-slate-700 z-50">
                          <div className="space-y-3">
                            <p className="font-bold border-b pb-1 text-blue-700">圖表計算說明：</p>
                            <ul className="text-xs space-y-2 list-disc pl-4">
                              <li>
                                <b className="text-blue-700 font-bold">我的正確率：</b>
                                顯示目前在特定單元下的平均正確率走勢。
                              </li>
                              <li>
                                <b className="text-red-600 font-bold">全校平均：</b>
                                作為基準線以判斷該校表現優於或低於整體該科平均。
                              </li>
                            </ul>
                              <p className="text-[12px] text-slate-400 pt-1 border-t">
                                ※ 透過此圖觀察曲線波動較大時，代表單元難度或教學進度可能有劇烈變化；若低於基準線，則建議進行補救教學。
                              </p>                       
                          </div>
                        </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
    
                  {/* AI 分析按鈕 */}
                  <button
                    onClick={() => runAIForChart("score_trend")}
                    className="
                      flex items-center justify-center
                      w-8 h-8
                      rounded-full
                      text-blue-500
                      hover:bg-blue-50
                      transition
                    "
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
    
              
              {/* 日 / 週 / 月 切換按鈕 */}
              <div className="flex items-center gap-1 mr-2 px-8">
                {["day", "week", "month"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode as any)}
                    className={`px-3 py-1 text-xs rounded-md transition
                      ${
                        viewMode === mode
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                  >
                    {mode === "day" ? "日線" : mode === "week" ? "週線" : "月線"}
                  </button>
                ))}
              </div>
              
    
              <CardContent className="h-[350px] w-full">
                <Plot
                  data={[
                    {
                      x: trendData.map(t => t.date),
                      y: trendData.map(t => t.avgScore),
                      type: "scatter",
                      mode: "lines+markers",
                      name: "我的正確率",
                      line: { color: "#2563eb", width: 3, shape: 'spline' }, 
                      hovertemplate: "我的正確率：%{y} <extra></extra>",
                    },
                    // 基準線：使用該學生的全局平均或校平均
                    {
                      x: trendData.map(t => t.date),
                      y: trendData.map(() => avgScoreCompare.classAvg || 0),
                      type: "scatter",
                      mode: "lines",
                      name: `全校平均 (${avgScoreCompare.classAvg}%)`,
                      line: { color: "#ef4444", width: 2, dash: "dash" },
                      hoverinfo: "skip", 
                    },
                  ]}
                  layout={{
                    height: 350,
                    margin: { t: 40, l: 50, r: 40, b: 80 },
                    xaxis: { type: "category", tickangle: -35, tickfont: { size: 10 } },
                    yaxis: { title: "正確率 (%)", range: [0, 105], ticksuffix: "%" },
                    legend: { orientation: "h", y: -0.3, x: 0.5, xanchor: "center" },
                    hovermode: "x unified",
                  }}
                  style={{ width: "100%", height: "100%" }}
                  config={{ displayModeBar: false, responsive: true }}
                />
              </CardContent>
            </Card>
          </div>

      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ===== 圖表 1：能力指標投入圖 ===== */}
        <Card className="col-span-1 relative">

          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
            {/* 左側：標題 */}
            <CardTitle 
              className="text-xl font-bold cursor-pointer hover:opacity-70 transition flex items-center gap-2 group"
              onClick={() => setSelectedIndicator("all")}
              title="點擊可清除指標篩選"
            >
              能力指標投入
              
            </CardTitle>

            {/* 右側：按鈕群組 */}
            <div className="flex items-center gap-0">
              {/* 圖表說明 Tooltip */}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="
                        flex items-center justify-center
                        w-8 h-8
                        rounded-full
                        text-slate-400
                        hover:bg-slate-100
                        hover:text-slate-600
                        transition
                        "
                    >
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
                        <p className="text-[12px] text-slate-400 pt-1 border-t">
                          ※ 透過此圖可以了解你的學習熱區，幫助你發現哪些知識點已經掌握、哪些還需要多加練習。
                        </p>
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
              <button
                onClick={() => runAIForChart("indicator_effect")}
                className="
                  flex items-center justify-center
                  w-8 h-8
                  rounded-full
                  text-blue-600
                  hover:bg-blue-50
                  hover:border-blue-300
                  transition
                  shadow-sm
                "
              >
                <Bot className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          {/* 🔥 加上 p-0 讓卷軸可以貼齊邊緣，並設定 overflow-x-auto */}
          <CardContent className="h-[300px] w-full p-0 pb-2">
            <div className="w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar">
              <div
                style={{
                  // 🔥 核心魔法：依照資料比例拉長寬度，確保視窗內最多只顯示 10 筆
                  width: chart1Data.xShort.length > 10 
                    ? `${(chart1Data.xShort.length / 10) * 100}%` 
                    : '100%',
                  height: '100%',
                  minWidth: '100%',
                }}
              >
                <Plot
                  onClick={(e) => {
                    if (e.points && e.points.length > 0) {
                      setSelectedIndicator(e.points[0].customdata as string);
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
                          selectedIndicator === "all" || selectedIndicator === name ? "#bfdbfe" : "#f1f5f9"
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
                          selectedIndicator === "all" || selectedIndicator === name ? "#2563eb" : "#cbd5e1"
                        )
                      },
                      line: { width: 3, color: "#94a3b8" },
                      hovertemplate: "<b>%{customdata}</b><br>平均正確率：%{y}%<extra></extra>",
                      customdata: chart1Data.xFull,
                    },
                  ]}
                  layout={{
                    autosize: true, // 確保圖表填滿我們剛剛設定的 div 寬度
                    margin: { t: 60, r: 40, b: 80, l: 50 }, // 稍微增加左邊距避免 Y 軸文字被切掉
                    xaxis: { 
                      tickangle: -30, 
                      tickfont: { size: 11 },
                      fixedrange: true // 禁止直接在圖上縮放，強迫使用者用下方卷軸
                    },
                    yaxis: { 
                      title: "練習次數", 
                      gridcolor: "#f1f5f9", 
                      zeroline: false,
                      fixedrange: true 
                    },
                    yaxis2: { 
                      title: "平均正確率 (%)", 
                      overlaying: "y", 
                      side: "right", 
                      range: [0, 110], 
                      showgrid: false,
                      fixedrange: true 
                    },
                    hovermode: "closest",
                    /* 正確率基準線 */
                    shapes: avgScoreCompare.classAvg !== null ? [
                      {
                        type: "line",
                        xref: "paper", x0: 0, x1: 1,
                        yref: "y2", y0: avgScoreCompare.classAvg, y1: avgScoreCompare.classAvg,
                        line: { color: "#ef4444", width: 2, dash: "dash" },
                      },
                    ] : [],
                    annotations: avgScoreCompare.classAvg !== null ? [
                      {
                        xref: "paper", x: 1,
                        yref: "y2", y: avgScoreCompare.classAvg,
                        text: `校平均 ${avgScoreCompare.classAvg}%`,
                        showarrow: false,
                        font: { size: 11, color: "#ef4444" },
                        xanchor: "right", yanchor: "bottom",
                      },
                    ] : [],
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

        {/* Chart 3: 差距條形圖（學生 vs 班級） */}
        <Card className="col-span-1 relative">

          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
              {/* 左側：標題 */}
              <CardTitle 
              className="text-xl font-bold cursor-pointer hover:opacity-70 transition flex items-center gap-2 group"
              onClick={() => setSelectedIndicator("all")}
              title="點擊可清除指標篩選"
            >
              能力指標差距
            </CardTitle>
              
              {/* 右側：按鈕群組 */}
              <div className="flex items-center gap-0">
                {/* 圖表說明 Tooltip */}
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="
                          flex items-center justify-center
                          w-8 h-8
                          rounded-full
                          text-slate-400
                          hover:bg-slate-100
                          hover:text-slate-600
                          transition
                          "
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                      <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f5f4fb] shadow-xl border-slate-200 text-slate-700 z-50">
                        <div className="space-y-3">
                          <p className="font-bold border-b pb-1 text-blue-700">圖表計算說明：</p>
                          <ul className="text-xs space-y-2 list-disc pl-4">
                            <li><b>中間基準線 (0%)：</b>代表全校同學的平均分。</li>
                            <li><b>學生表現：</b>採用你對該指標<b>「最後一次練習」</b>的成績計算。</li>
                            <li><b>綠色向右 (+)：</b>代表你目前的精熟度已超越全校平均。</li>
                            <li><b>紅色向左 (-)：</b>代表你目前的掌握度尚低於全校平均。</li>
                          </ul>
                          <p className="text-[12px] text-slate-400 pt-1 border-t">
                            ※ 透過此圖可以快速抓出你的強項與弱項，讓你的學習更有效率。
                          </p>
                        </div>
                      </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* AI 分析按鈕 */}
                <button
                  onClick={() => runAIForChart("indicator_gap")}
                  className="
                    flex items-center justify-center
                    w-8 h-8
                    rounded-full
                    text-blue-600
                    hover:bg-blue-50
                    hover:border-blue-300
                    transition
                    shadow-sm
                  "
                >
                  <Bot className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
          <CardContent className="p-0"> 
            <div className="h-[300px] overflow-y-auto overflow-x-hidden custom-scrollbar">
              <Plot
                onClick={(e) => {
                  //確保從 customdata 抓出來的是沒有 <br> 的 original_name
                  if (e.points && e.points.length > 0) {
                    setSelectedIndicator((e.points[0].customdata as any)[0]);
                  }
                }}
                data={[
                  {
                    type: "bar",
                    orientation: "h",
                    x: diffBarData.map(d => d.latestDiff),
                    y: diffBarData.map(d => d.indicator),
                    marker: {
                      // 顏色比對時使用 original_name
                      color: diffBarData.map(d => {
                        const isSelected = selectedIndicator === "all" || selectedIndicator === d.original_name;
                        if (d.latestDiff >= 0) return isSelected ? "#16a34a" : "rgba(218, 248, 227, 0.5)"; 
                        return isSelected ? "#dc2626" : "rgba(252, 220, 220, 0.5)"; 
                      }),
                    },
                    text: diffBarData.map(d => `${d.latestDiff >= 0 ? "+" : ""}${d.latestDiff}%`),
                    textposition: "inside",
                    // 🔥 修正點 2：把 original_name 放在陣列第一個位置 [0]，供 onClick 使用
                    // 將帶有 <br> 的 indicate_name 放到第四個位置 [3]，供 hovertemplate 顯示使用
                    customdata: diffBarData.map(d => [
                      d.original_name, 
                      d.latestScore, 
                      d.classAvg, 
                      d.indicate_name
                    ]),
                    hovertemplate:
                    "<b>%{y} - %{customdata[3]}</b><br>" + // 🔥 這裡改用 customdata[3] 來顯示帶換行的名稱
                    "最新表現：%{customdata[1]}%<br>" +
                    "全校平均：%{customdata[2]}%<br>" +
                    "目前差距：%{x}%<extra></extra>",
                  },
                ]}
                layout={{
                // 動態計算高度：每筆資料給 40px，確保不縮放
                height: Math.max(300, diffBarData.length * 25), 
                autosize: true,
                margin: { l: 120, r: 50, t: 45, b: 80 },
                showlegend: false,
                xaxis: {
                  title: "與校平均差距（%）",
                  zeroline: true,
                  zerolinewidth: 2,
                  zerolinecolor: "#94a3b8",
                  side: "top", // 讓標題留在頂部，滑動時才看得到
                  fixedrange: true, // 禁止縮放
                },
                yaxis: {
                  automargin: true,
                  fixedrange: true, // 禁止在圖表上拖曳縮放，改用外部卷軸
                },
                // 0 基準線裝飾
                shapes: [
                {
                  type: "line",
                  x0: 0,
                  x1: 0,
                  yref: "paper",
                  y0: 0,
                  y1: 1,
                  line: {
                    color: "#475569",
                    width: 2,
                    dash: "dash",
                  },
                },
              ],

              annotations: [
                {
                  x: 0,
                  y: 1.07,
                  yref: "paper",
                  text: "校平均",
                  showarrow: false,
                  font: { size: 11, color: "#64748b", weight: "bold" },
                  xanchor: "center",
                },
              ],

                font: { family: "inherit" },
              }}
              config={{ 
                displayModeBar: false, 
                responsive: true,
                staticPlot: false 
              }}
              style={{ width: "100%", cursor: "pointer" }}
            />
            </div>
          </CardContent>
        </Card>

        {/* ===== 進步幅度分析圖 ===== */}
        <Card className="col-span-1 relative">

          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-4">
            <CardTitle 
            className="text-xl font-bold cursor-pointer hover:opacity-70 transition flex items-center gap-2 group"
            onClick={() => setSelectedIndicator("all")}
          >
            進步幅度變化
            
          </CardTitle>
          {/* 右側：按鈕群組 */}
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
                        <li><b>中間基準線 (0)：</b>代表此次練習正確率與前一次「持平」。</li>
                        <li><b>綠色點與正值 (+)：</b>代表正確率「進步」，數值越高進步越多。</li>
                        <li><b>紅色點與負值 (-)：</b>代表正確率「退步」，可能遇到了新的學習瓶頸。</li>
                        <li><b>點擊互動：</b>在全部指標模式下，點擊圖表上的點可以「下鑽」查看該單一指標的詳細進步軌跡。</li>
                      </ul>
                      <p className="text-[12px] text-slate-400 pt-1 border-t">
                        ※ 透過此圖可以觀察自己的學習穩定度，大起大落可能代表正在猜題或概念尚未穩固。
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
              <button
                onClick={() => runAIForChart("progress_trend")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition shadow-sm"
              >
                <Bot className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          
          <CardContent className="h-[300px] w-full">
            <Plot
              onClick={(e) => {
                // 連動點擊：如果在 "all" 模式下點了某個點，就過濾到該指標
                if (e.points && e.points.length > 0) {
                  setSelectedIndicator((e.points[0].customdata as any)[0]);
                }
              }}
              data={[
                {
                  x: progressTrendData?.x || [],
                  y: progressTrendData?.y || [],
                  type: "scatter",
                  mode: "lines+markers",
                  marker: {
                    size: 8,
                    color: progressTrendData?.colors || [],
                  },
                  line: { width: 2 },
                  customdata: progressTrendData?.customdata || [],
                  // 動態切換 Hover 提示框的時間格式
                  hovertemplate: 
                    "<b>指標：</b>%{customdata[0]}<br>" +
                    `<b>時間：</b>%{x|${selectedIndicator === "all" ? "%Y-%m-%d" : "%Y-%m-%d %H:%M:%S"}}<br>` + 
                    "<b>進步幅度：</b>%{y:.2f}%<br>" +
                    "<b>作答時間：</b>%{customdata[1]} 秒<br><extra></extra>",
                  name: "進步幅度",
                },
              ]}
              layout={{
                
                // 動態切換底部邊距：顯示秒數時字比較長，需要多留一點空間 (110)，只顯示日期時留 80 即可
                margin: { t: 40, l: 30, r: 30, b: selectedIndicator === "all" ? 50 : 110 }, 

                xaxis: {
                  title: "時間",
                  tickangle: -30,
                  type: "date",
                  // 動態切換 X 軸標籤的時間格式
                  tickformat: selectedIndicator === "all" ? "%Y-%m-%d" : "%Y-%m-%d %H:%M:%S", 
                  tickfont: { size: 10 }, 
                },

                yaxis: {
                  title: "進步幅度（正確率變化）",
                  zeroline: true,
                  zerolinewidth: 1,
                  zerolinecolor: "#999",
                },
                shapes: [
                  {
                    type: "line",
                    x0: 0,
                    x1: 1,
                    xref: "paper",
                    y0: 0,
                    y1: 0,
                    line: {
                      color: "#94a3b8",
                      width: 1,
                      dash: "dot",
                    },
                  },
                ],

                hovermode: "closest",
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%", height: "100%", cursor: selectedIndicator === "all" ? "pointer" : "default" }}
            />
          </CardContent>
        </Card>
      </div>

      {/* ===== 圖表：學習歷程表現圖 ===== */}
      <Card className="col-span-1 relative">

        {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

        <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
          <CardTitle 
            className="text-xl font-bold cursor-pointer hover:opacity-70 transition flex items-center gap-2 group"
            onClick={() => setSelectedIndicator("all")}
          >
            學習歷程表現
            {selectedIndicator !== "all" && (
              <>
                <span className="text-slate-300">/</span>
                <span className="text-sm text-blue-700 px-1 py-2">{selectedIndicator}</span>
              </>
            )}
          </CardTitle>
          {/* 右側：按鈕群組 */}
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
                        <li><b>點擊互動：</b>點擊圓點可以查看該單元的「歷史進步軌跡」。</li>
                        <li><b>答題速度（X軸）：</b>往左代表思考愈快，往右代表花比較多時間。</li>
                        <li><b>正確率 (Y軸)：</b>愈往上代表答對的情況愈好。</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
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
              // 連動點擊
              if (chart3Data.mode === "overview" && data.points.length > 0) {
                setSelectedIndicator(data.points[0].text as string);
              }
            }}
            data={
                chart3Data.mode === "overview"
                  ? [
                      // ===== 總覽模式：每個單元的最新作答 =====
                      {
                        x: chart3Data.x,
                        y: chart3Data.y,
                        mode: "markers", 
                        type: "scatter",
                        text: chart3Data.text,
                        marker: {
                          size: 14,
                          color: chart3Data.zone.map(z => ZONE_COLOR[z as keyof typeof ZONE_COLOR]),
                          opacity: 0.85,
                          line: { color: "white", width: 2 },
                        },
                        customdata: chart3Data.zone.map((z, i) => [z, chart3Data.itemsCount[i]]),
                        hovertemplate:
                          "<b>%{text}</b><br>" + 
                          "狀態：%{customdata[0]}<br>" +
                          "作答時間：%{x:.1f} 秒/題<br>" +
                          "正確率：%{y:.0f}%<br>" +
                          "<i>(點擊查看歷次進步軌跡)</i>" +
                          "<extra></extra>",
                        name: "最新作答",
                      },
                    ]
                  : [
                      // ===== 詳細模式：歷次作答軌跡 =====
                      {
                        x: chart3Data.x,
                        y: chart3Data.y,
                        // 加入 lines，讓歷史軌跡有一條虛線連接著，更有「歷程」的感覺
                        mode: "lines+markers+text",
                        type: "scatter",
                        text: chart3Data.text,
                        textposition: "top center",
                        line: { color: "#cbd5e1", width: 2, dash: "dot" }, 
                        marker: {
                          size: 14,
                          color: chart3Data.zone.map(z => ZONE_COLOR[z as keyof typeof ZONE_COLOR]),
                          opacity: 0.85,
                          line: { color: "white", width: 2 },
                        },
                        customdata: chart3Data.zone,
                        hovertemplate:
                          "<b>第%{text}次</b><br>" +
                          "作答時間：%{x:.1f} 秒/題<br>" +
                          "正確率：%{y:.0f}%<br>" +
                          "狀態：<b>%{customdata}</b><extra></extra>",
                        name: "歷次作答",
                      },
                      // ===== 詳細模式：最新一次作答（黃框標記） =====
                      {
                        x: chart3Data.x.filter((_, i) => (chart3Data as any).isLatest[i]),
                        y: chart3Data.y.filter((_, i) => (chart3Data as any).isLatest[i]),
                        mode: "markers",
                        type: "scatter",
                        marker: {
                          size: 18,
                          color: "rgba(255, 255, 255, 0)",
                          line: { color: "#eab308", width: 3 }, // 黃色外框
                        },
                        hoverinfo: "skip",
                        name: "最新一次作答",
                      },
                    ]
              }
              layout={{
                height: 300,
                margin: { t: 20, r: 20, b: 70, l: 40 }, 

                xaxis: {
                  title: {
                    text: "平均每題作答時間（秒）", 
                    font: { size: 10, color: '#64748b' },
                    standoff: 15
                  },
                  gridcolor: "#f1f5f9",
                  zeroline: false,
                },

                yaxis: {
                  title: {
                    text: "正確率 (%)",
                    font: { size: 10, color: '#64748b' },
                    standoff: 15
                  },
                  range: [0, 115],
                  tickformat: ",.0f",
                  gridcolor: "#f1f5f9",
                },

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

                showlegend: false, 
                // 當處於總覽模式時，設定滑鼠游標為 pointer 提示可點擊
                hovermode: "closest",
              }}
              useResizeHandler
              style={{ width: "100%", height: "100%", cursor: chart3Data.mode === "overview" ? "pointer" : "default" }}
              config={{ displayModeBar: false, responsive: true }}
            />
        </CardContent>
      </Card>

    
       
        {/* ===== 詳細練習紀錄  ===== */}
        <Card className="col-span-1 shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-col md:flex-row md:items-center py-4 pb-2 gap-4">
            <CardTitle className="text-xl font-bold text-slate-700 flex items-center gap-2">
              詳細練習紀錄 
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">能力指標：</span>
              <Select
                value={selectedIndicator} // 直接綁定全域狀態
                onValueChange={setSelectedIndicator}
              >
                <SelectTrigger className="w-[420px] h-8 text-xs focus:ring-0 font-medium text-slate-700 bg-slate-50 border rounded">
                  <SelectValue placeholder="選擇能力指標" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部能力指標</SelectItem>
                  {detailAvailableIndicators.map(ind => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0 pt-2">
            <div className="max-h-[350px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-xs text-slate-500 border-b">
                    <th className="p-3 px-4 min-w-[120px]">練習日期</th>
                    {Array.from({ length: maxItemCount }).map((_, i) => (
                      <th key={i} className="p-3 text-center">題{i + 1}</th>
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
                    <tr><td colSpan={maxItemCount + 3} className="text-center py-8 text-slate-400">尚無符合條件的作答紀錄</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}