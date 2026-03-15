import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import { supabase } from "@/lib/supabase";
import { useUserContext } from "@/contexts/UserContext";
import { buildStudentPracPrompt } from "@/lib/ai/buildStudentPracPrompt";
import dayjs from "dayjs";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Filter, 
  Activity,
  Sparkles, 
  HelpCircle,
  Target, 
  Clock, 
  TrendingUp,
  Zap,
  AlertTriangle,
  CheckCircle2, 
  Bot,
  BotIcon
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
  is_correct: number; // 1 / 0
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
  indicator: string;       // 指標代號 (如 S1)
  indicate_name: string;   // 指標名稱
  classAvg: number;        // 全校/班級平均
  latestScore: number;     // 個人最新分數
  historicalAvg: number;   // 個人歷次平均
  latestDiff: number;      // 最新分數與校平均的差距
  avgDiff: number;         // 歷次平均與校平均的差距
}



type ExplainTarget =
  | "daily_overview"    // 練習狀況表現
  | "practice_trend"    // 練習投入走勢
  | "score_trend"       // 學習成效走勢
  | "indicator_effect"  // 能力指標投入
  | "learning_process"  // 學習歷程表現
  | "indicator_gap";    // 能力指標差距





/* =========================
   Main Component
   ========================= */

export default function StudentPrac() {
  const navigate = useNavigate();
  const { userSn, organizationId, gradeId, classId } = useUserContext();

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
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedIndicator, setSelectedIndicator] = useState<string>("all");

  // AI
  const [showAI, setShowAI] = useState(false);
  const [geminiResult, setGeminiResult] = useState<string | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [selectedCharts, setSelectedCharts] = useState<ExplainTarget[]>(["daily_overview",]);



  /* =========================
     Data Fetching
     ========================= */
  useEffect(() => {
    const fetchData = async () => {
      if (!userSn) return;
      setLoading(true);

      // 1. Fetch Daily
      const setDailyReq = supabase
        .from("prac_daily")
        .select("*")
        .eq("user_sn", userSn)
        .order("activity_date", { ascending: true });

      // 2. Fetch Attempts
      const attemptsReq = supabase
        .from("prac_attempts")
        .select("*")
        .eq("user_sn", userSn)
        .order("date", { ascending: true });

      // 3. Fetch Indicator
      const indicatorReq = supabase
        .from("prac_indicate")
        .select("*")
        .eq("user_sn", userSn);

      // 4. Fetch class Attempts
      const OrgIndicatorReq = supabase
      .from("prac_organization")
      .select("subject_name, indicator, indicate_name, school_avg_score_rate, participant_count, school_prac_count, school_avg_time_sec")
      .eq("organization_id", organizationId)
      

      // 5. fetch item
      const itemsReq = supabase
        .from("prac_attempts_item")
        .select("*")
        .eq("user_sn", userSn)
        .order("date", { ascending: true });


      const [DailyRes, attemptsRes, indicatorRes, OrgIndicatorRes, items] =
        await Promise.all([setDailyReq, attemptsReq, indicatorReq, OrgIndicatorReq, itemsReq]);

      if (attemptsRes.error) {
      console.error("Error fetching attempts:", attemptsRes.error);
    } else {
      const data = (attemptsRes.data as AttemptRow[]) || [];
      setAttemptsData(data);

      // --- 新增：計算並設定資料期間 ---
      if (data.length > 0) {
        // 假設 date 格式為 'YYYY-MM-DD' 或 ISO 格式，進行排序
        const sortedDates = data
          .map(d => d.date)
          .filter(Boolean)
          .sort();
        
        setStartDate(sortedDates[0]); // 最早日期
        setEndDate(sortedDates[sortedDates.length - 1]); // 最晚日期
      } else {
        setStartDate(null);
        setEndDate(null);
      }
      // ----------------------------
    }

    setDailyData((DailyRes.data as DailyRow[]) || []);
    setIndicatorData((indicatorRes.data as IndicatorRow[]) || []);
    setOrgIndicatorData(OrgIndicatorRes.data || []);
    setPracItems((items.data as PracItemRow[]) || []);
    setLoading(false);
  };

  fetchData();
}, [userSn]);

  /* =========================
     Data Processing 
     ========================= */

  // 1. 取得所有科目清單
  const uniqueSubjects = useMemo(() => {
    return _.uniq(attemptsData.map(d => d.subject_name)).sort();
  }, [attemptsData]);

  // 2. 根據篩選器過濾資料
  const filteredAttempts = useMemo(() => {
  return attemptsData.filter(d => {
    if (selectedSubject !== "all" && d.subject_name !== selectedSubject)
      return false;
    if (selectedIndicator !== "all" && d.indicate_name !== selectedIndicator)
      return false;
    return true;
  });
}, [attemptsData, selectedSubject, selectedIndicator]);


  // 依科目產生能力指標選項
  const availableIndicators = useMemo(() => {
    const base =
      selectedSubject === "all"
        ? attemptsData
        : attemptsData.filter(d => d.subject_name === selectedSubject);

    return _.uniq(base.map(d => d.indicate_name)).sort();
  }, [attemptsData, selectedSubject]);

  const filteredPracItems = useMemo<PracItemRow[]>(() => {
  return pracItems.filter(i => {
    if (selectedIndicator !== "all" && i.indicate_name !== selectedIndicator)
      return false;
    return true;
  });
}, [pracItems, selectedIndicator]);

//詳細練習紀錄
  const detailedRows = useMemo<PracDetailRow[]>(() => {
  if (filteredPracItems.length === 0) return [];

  const byPrac: Record<number, PracItemRow[]> = _.groupBy(
    filteredPracItems,
    "prac_answer_sn"
  );

  return Object.values(byPrac).map((items: PracItemRow[]) => {
    const first = items[0];

    const correctCount = items.filter(i => i.is_correct === 1).length;
    const totalCount = items.length;

    const avgTime =
      totalCount > 0
        ? _.meanBy(items, "ans_time_ms") ?? 0
        : 0;

    return {
      prac_answer_sn: first.prac_answer_sn,
      date: first.date,
      items, 
      avg_item_time_ms: avgTime,
      score_rate: (correctCount / totalCount) * 100,
    };
  }).sort(
      (a, b) => b.prac_answer_sn - a.prac_answer_sn
    );
}, [filteredPracItems]);

 
  const maxItemCount = useMemo(() => {
    return Math.max(0, ...detailedRows.map((r) => r.items.length));
  }, [detailedRows]);
  

  // 3. KPI 與 最新狀態
  const processedStats = useMemo(() => {
  const totalCount = filteredAttempts.length;
    
    // 1. 找出符合目前過濾條件的校級資料
    const matchedOrgRows = OrgIndicatorData.filter(d => {
      const matchSubject = selectedSubject === "all" || d.subject_name === selectedSubject;
      const matchIndicator = selectedIndicator === "all" || d.indicate_name === selectedIndicator;
      return matchSubject && matchIndicator;
    });

    // 2. 練習人數 (userCount)：
    // 若選「全部科目」，取各指標中參與人數的最大值（代表該校有多少人參與過這類練習）
    const userCount = matchedOrgRows.length > 0 
      ? Math.max(...matchedOrgRows.map(d => d.participant_count || 0)) 
      : 0;

    // 3. 全校平均練習次數 (schoolAvgCount)：
    // 邏輯：該範圍內的校總練習次數加總 / 參與人數
    const schoolTotalPracSum = _.sumBy(matchedOrgRows, "school_prac_count");
    const schoolAvgCount = userCount > 0 
      ? (schoolTotalPracSum / userCount).toFixed(1) 
      : "0.0";
  const totalTime = _.sumBy(filteredAttempts, "during_time");

  const avgScore =
    totalCount > 0 ? _.meanBy(filteredAttempts, "score_rate") : 0;

  const avgSpeedSec =
    totalCount > 0
      ? (_.meanBy(filteredAttempts, "avg_item_time_ms") / 1000).toFixed(1)
      : "0.0";

  const attemptsByIndicator = _.groupBy(
    filteredAttempts,
    "indicate_name"
  );

  let improvedCount = 0; // 克服弱點：曾不及格 → 現在滿分
  let perfectCount = 0;  // 達成滿分：一直都很優秀 → 現在滿分
  let struggleCount = 0; // 目前仍低分：最新一次不及格

  // 門檻值定義
  const PASS_THRESHOLD = 0.6;    // 60%
  const PERFECT_THRESHOLD = 0.99; // 100%

  // 判定函式：自動相容小數 (0.5) 與整數 (50) 格式
  const checkIsLow = (score) => {
    const s = Number(score);
    // 如果數值大於 1，判定為整數制 (如 50 < 60)；否則為小數制 (如 0.5 < 0.6)
    return s > 1 ? s < 60 : s < PASS_THRESHOLD;
  };

  const checkIsPerfect = (score) => {
    const s = Number(score);
    // 判定是否為 100 或 1.0 (考慮浮點數誤差)
    return s === 100 || s >= PERFECT_THRESHOLD;
  };

  Object.values(attemptsByIndicator).forEach((attempts) => {
    // 1. 確保依日期排序（若日期相同則依 id 排序確保穩定）
    const sorted = _.orderBy(attempts, ["date", "id"], ["asc", "asc"]);
    if (!sorted.length) return;

    const latest = sorted[sorted.length - 1];
    const latestScore = Number(latest.score_rate);

    // 2. 核心邏輯判定
    // 只要歷史紀錄中有「任何一筆」低於及格線，everLow 即為 true
    const everLow = sorted.some(a => checkIsLow(a.score_rate));
    const isLatestPerfect = checkIsPerfect(latestScore);

    // 3. 分類統計
    if (isLatestPerfect) {
      if (everLow) {
        // 符合您的需求：曾經低分 (例如 50% 或 0.5)，現在滿分
        improvedCount++; 
      } else {
        // 從未低分過，且現在滿分
        perfectCount++;  
      }
    }

    // 4. 判定目前是否仍處於掙扎狀態 (最新一次不及格)
    if (checkIsLow(latestScore)) {
      struggleCount++;
    }

  });

  // 目標達成邏輯：沒有人在掙扎，且至少有人達到滿分
  const reachedGoal = struggleCount === 0 && (improvedCount > 0 || perfectCount > 0);


  return {
    count: totalCount,
    userCount,          
    schoolAvgCount,
    totalTime: Math.round(totalTime),
    avgScore: Math.round(avgScore * 100),
    avgSpeedSec,
    struggleCount,
    improvedCount,
    perfectCount,
    reachedGoal,
  };
}, [filteredAttempts]);


  /// 低於班級平均
/// KPI4：指標表現狀態 (修改後：只要有過一次 100% 就算克服)
  const belowClassAvgStats = useMemo(() => {
    if (!filteredAttempts.length) {
      return {
        count: 0,
        classPracPeople: null,
      };
    }

    // 1. 先將目前的練習紀錄按「能力指標」分組
    const attemptsByIndicator = _.groupBy(filteredAttempts, "indicate_name");

    let struggleCount = 0;

    // 2. 檢查每一個指標的紀錄
    Object.values(attemptsByIndicator).forEach((attempts: AttemptRow[]) => {
      // 現在 TypeScript 知道 attempts 是陣列，就能使用 .some 了
      const hasPerfectRecord = attempts.some(a => 
        (a.score_rate >= 0.99 && a.score_rate <= 1) || a.score_rate === 100
      );
      
      if (!hasPerfectRecord) {
        struggleCount++;
      }
    });

    // 3. 獲取班級練習人數 (維持原樣)
    const classPracPeople =
      OrgIndicatorData.length > 0
        ? Math.max(...OrgIndicatorData.map(c => c.participant_count || 0))
        : null;

    return {
      count: struggleCount, // 這裡的 count 代表「尚未拿過滿分的指標數量」
      classPracPeople,
    };
  }, [filteredAttempts, OrgIndicatorData]);



  //班級平均秒數
  const avgSpeedCompare = useMemo(() => {
  if (!filteredAttempts.length || !OrgIndicatorData.length) {
    return {
      studentAvgSec: 0,
      classAvgSec: null,
      diff: null
    };
  }

  // ① 學生投入時間（只算目前篩選後資料）
  const studentAvgSec =
    _.meanBy(filteredAttempts, "during_time");

  // ② 對應「學生有練過的單元」的班級平均秒數
  const matchedClassRows = filteredAttempts
    .map(a =>
      OrgIndicatorData.find(
        c =>
          c.subject_name === a.subject_name &&
          c.indicate_name === a.indicate_name &&
          c.school_avg_time_sec !== null
      )
    )
    .filter(Boolean) as OrgIndicatorRow[];

  if (!matchedClassRows.length) {
    return {
      studentAvgSec: studentAvgSec.toFixed(1),
      classAvgSec: null,
      diff: null
    };
  }

  const classAvgSec =
    _.meanBy(matchedClassRows, "class_avg_time_sec");

    return {
      studentAvgSec: studentAvgSec.toFixed(0),
      classAvgSec: classAvgSec.toFixed(0),
      diff: (studentAvgSec - classAvgSec).toFixed(0)
    };
  }, [filteredAttempts, OrgIndicatorData]);




  // 4. Indicator 列表 (用於圖表一、三)
  const filteredIndicators = useMemo(() => {
    if (selectedSubject === "all") return indicatorData;
    const activeNames = new Set(filteredAttempts.map(d => d.indicate_name));
    return indicatorData.filter(d => activeNames.has(d.indicate_name));
  }, [indicatorData, filteredAttempts, selectedSubject]);

  /* =========================
       資料期間顯示
    ========================= */
    const periodLabel = useMemo(() => {
      // 改用過濾後的資料來決定顯示的區間
      if (filteredAttempts.length === 0) return "資料期間：無數據";
      
      const dates = filteredAttempts.map(d => d.date).sort();
      const start = dates[0];
      const end = dates[dates.length - 1];
      
      const s = dayjs(start).format("YYYY/MM/DD");
      const e = dayjs(end).format("YYYY/MM/DD");
      const days = dayjs(end).diff(dayjs(start), "day") + 1;
      
      return `篩選資料期間：${s} ～ ${e}（${days} 天）`;
    }, [filteredAttempts]); // 這裡監聽過濾後的結果

  /* =========================
     Chart Data Preparation
     ========================= */

  // 圖表一：Pareto (Bar + Line)
  const chart1Data = useMemo(() => {
    if (!filteredIndicators.length) {
      return {
        xShort: [],
        xFull: [],
        yBar: [],
        yLine: [],
        meta: [],
      };
    }
    // 依「練習次數」排序
    const sorted = _.orderBy(
      filteredIndicators,
      ["in_prac_count"],
      ["desc"]
    ).slice(0, 15);
    const makeShortLabel = (name: string, idx: number) =>
      `能力指標 ${idx + 1}`;
    return {
      xShort1: sorted.map((_, idx) =>
        makeShortLabel(_.indicator, idx)
      ),
      xShort: sorted.map(d => d.indicator),
      xFull: sorted.map(d => d.indicate_name),
      yBar: sorted.map(d => d.in_prac_count),
      yLine: sorted.map(d =>
        Math.round(d.in_avg_score_rate)
      ),
      // 分析用 metadata（後面四象限會直接用）
      meta: sorted.map(d => ({
        indicate_name: d.indicate_name,
        prac_count: d.in_prac_count,
        avg_score: Math.round(d.in_avg_score_rate),
        total_items: d.in_total_items,
        total_wrong: d.in_total_wrong,
      })),
    };
  }, [filteredIndicators]);
  

  // 中位數計算
  const calculateMedian = (values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };

 

  // 圖表二：診斷散佈圖
  const chart3Data = useMemo(() => {
  if (!filteredAttempts.length) {
    return {
      x: [],
      y: [],
      text: [],
      zone: [],
      attemptIndex: [],
      isLatest: [],
      medianTimeSec: 0,
      passScore: 60,
    };
  }

  // 每個能力指標內排序
  const attemptsWithIndex = _.flatMap(
    _.groupBy(filteredAttempts, "indicate_name"),
    (attempts) => {
      const sorted = _.orderBy(attempts, ["date"], ["asc"]);
      return sorted.map((a, idx) => ({
        ...a,
        attemptIndex: idx + 1,
        totalAttempts: sorted.length,
        isLatest: idx === sorted.length - 1,
        avg_item_time_sec:
          a.items_count > 0
            ? a.during_time / a.items_count
            : 0,
      }));
    }
  );

  // 只保留有題數的
  const validPoints = attemptsWithIndex.filter(
      d => d.items_count > 0
    );

    if (!validPoints.length) {
      return {
        x: [],
        y: [],
        text: [],
        zone: [],
        attemptIndex: [],
        isLatest: [],
        medianTimeSec: 5,
        passScore: 60,
      };
    }

    const timeSecValues = validPoints.map(
      d => d.avg_item_time_sec
    );

    const medianTimeSec = calculateMedian(timeSecValues) || 5;
    const passScore = 60;

    const zoneOf = (d: any) => {
      const acc = d.score_rate;
      const timeSec = d.avg_item_time_sec;

      if (acc >= passScore && timeSec <= medianTimeSec) return "精熟區";
      if (acc >= passScore && timeSec > medianTimeSec) return "穩定區";
      if (acc < passScore && timeSec <= medianTimeSec) return "猜測區";
      return "卡關區";
    };

    return {
      x: validPoints.map(d => d.avg_item_time_sec),
      y: validPoints.map(d => d.score_rate),
      text: validPoints.map(
        d =>
          `${d.indicate_name}` +
          `<br>第 ${d.attemptIndex} 次` +
          `<br>題數：${d.items_count}`
      ),
      attemptIndex: validPoints.map(d => d.attemptIndex),
      isLatest: validPoints.map(d => d.isLatest),
      zone: validPoints.map(d => zoneOf(d)),
      medianTimeSec,
      passScore,
    };
  }, [filteredAttempts]);


  const ZONE_COLOR: Record<string, string> = {
  精熟區: "#22c55e", // 綠
  穩定區: "#3b82f6", // 藍
  猜測區: "#f97316", // 橘
  卡關區: "#ef4444", // 紅
  };





  //班級正確率比較
  const activeIndicators = useMemo(() => {
      return _.uniqBy(
        filteredAttempts.map(d => ({
          subject_name: d.subject_name,
          indicate_name: d.indicate_name
        })),
        d => `${d.subject_name}__${d.indicate_name}`
      );
    }, [filteredAttempts]);

    
    const matchedClassIndicators = useMemo(() => {
      if (!OrgIndicatorData.length) return [];

      return activeIndicators
        .map(({ subject_name, indicate_name }) => {
          const classRow = OrgIndicatorData.find(
            c =>
              c.subject_name === subject_name &&
              c.indicate_name === indicate_name
          );

          return classRow
        ? {
            subject_name,
            indicator: classRow.indicator, 
            indicate_name,
            class_avg_score_rate: classRow.school_avg_score_rate
          }
        : null;
        })
        .filter(Boolean);
    }, [activeIndicators, OrgIndicatorData]);

    
  const avgScoreCompare = useMemo(() => {
      if (!filteredAttempts.length || !matchedClassIndicators.length) {
        return {
          studentAvg: 0,
          classAvg: null,
          diff: null
        };
      }

      // 學生在「自己練過單元」的平均
      const studentAvg =
        _.meanBy(filteredAttempts, "score_rate");

      // 班級在「相同單元」的平均
      const classAvg =
        _.meanBy(matchedClassIndicators, "class_avg_score_rate");

      return {
        studentAvg: Math.round(studentAvg),
        classAvg: Math.round(classAvg),
        diff: Math.round(studentAvg - classAvg)
      };
    }, [filteredAttempts, matchedClassIndicators]);

  // 圖表三：差距條形圖資料（學生最新表現 vs 班級平均）
  const diffBarData = useMemo<DiffBarRow[]>(() => {
    if (!filteredAttempts.length || !matchedClassIndicators.length) return [];

    const splitLongText = (str: string, len: number = 20) => {
      if (!str) return "";
      const regex = new RegExp(`.{1,${len}}`, "g");
      return str.match(regex)?.join("<br>") || str;
    };

    // 取得每個指標的數據分組
    const groups = _.groupBy(filteredAttempts, "indicate_name");

    const rows = Object.entries(groups).map(([indicate_name, attempts]) => {
      const classRow = matchedClassIndicators.find(c => c.indicate_name === indicate_name);
      if (!classRow) return null;

      const classAvg = classRow.class_avg_score_rate;
      
      // A. 最新一次表現
      const sorted = _.orderBy(attempts, ["date", "prac_answer_sn"], ["asc", "asc"]);
      const latestScore = sorted[sorted.length - 1].score_rate;
      const latestDiff = Math.round(latestScore - classAvg);

      // B. 個人歷次平均
      const historicalAvg = _.meanBy(attempts, "score_rate");
      const avgDiff = Math.round(historicalAvg - classAvg);

      return {
        indicator: classRow.indicator || "",
        indicate_name: splitLongText(indicate_name, 20),
        latestScore: Math.round(latestScore),
        historicalAvg: Math.round(historicalAvg),
        classAvg: Math.round(classAvg),
        latestDiff,
        avgDiff
      };
    }).filter(Boolean);

    // 依「最新表現差距」排序
    return _.orderBy(rows, ["latestDiff"], ["asc"]);
  }, [filteredAttempts, matchedClassIndicators]);

const formatDateTime = (iso: string) => {
  if (!iso) return "";
  
  const d = new Date(iso);
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC' 
  }).replace(/\//g, '-'); 
};


/* =========================
     練習投入與學習成效走勢
========================= */
const trendData = useMemo(() => {
  // 1. 強制斷言 attemptsData 為 AttemptRow 陣列，避免 unknown 報錯
  const rawData = (attemptsData || []) as AttemptRow[];

  // 2. 進行過濾
  const filtered: AttemptRow[] = rawData.filter((d) => {
    const matchSubject = selectedSubject === "all" || d.subject_name === selectedSubject;
    const matchIndicator = selectedIndicator === "all" || d.indicate_name === selectedIndicator;
    return matchSubject && matchIndicator;
  });

  
  if (filtered.length === 0) return [];

  // 3. 根據 viewMode 進行分組
  const grouped = _.groupBy(filtered, (r) => {
    const d = dayjs(r.date);
    if (viewMode === "day") return d.format("YYYY-MM-DD");
    if (viewMode === "week") return d.startOf("week").format("YYYY-MM-DD");
    return d.startOf("month").format("YYYY-MM-DD");
  });

  // 4. 計算並回傳格式化後的陣列
  return Object.entries(grouped).map(([date, rows]) => {
    const currentRows = rows as AttemptRow[];
    
    const totalPrac = currentRows.length;
    const totalTimeMin = _.sumBy(currentRows, "during_time") / 60;
    
    const totalItems = _.sumBy(currentRows, "items_count");
    const weightScoreSum = _.sumBy(currentRows, (r) => (r.score_rate || 0) * (r.items_count || 0));
    const avgScore = totalItems > 0 ? weightScoreSum / totalItems : 0;

    return {
      date,
      totalPrac,
      totalTimeMin: Math.round(totalTimeMin * 10) / 10,
      avgScore: Math.round(avgScore),
    };
  }).sort((a, b) => a.date.localeCompare(b.date));

}, [attemptsData, viewMode, selectedSubject, selectedIndicator]);

  
/* =========================
   AI 助手
========================= */
const runAIForChart = async (chart: ExplainTarget) => {
  setGeminiLoading(true);

  const prompt = buildStudentPracPrompt({
    date: selectedDate,
    subject: selectedSubject,
    indicator: selectedIndicator,
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
      indicatorGap: diffBarData
      
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
      indicator: selectedIndicator,
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
          indicatorGap: diffBarData
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
  selectedIndicator,
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
};





  /* =========================
     Render
     ========================= */

  return (
    <div className="min-h-screen p-4 space-y-6">

      {/* 1. Header & Filter */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 p-2 pb-1">
          <div className="p-2 text-slate-400">
            <Filter className="w-5 h-5"/>
          </div>

          {/* 科目 */}
          <span className="text-sm">科目：</span>
          <Select
            value={selectedSubject}
            onValueChange={(val) => {
              setSelectedSubject(val);
              setSelectedIndicator("all");
            }}
          >
            <SelectTrigger className="w-[150px] focus:ring-0 font-medium text-slate-700 bg-white border rounded">
              <SelectValue placeholder="選擇科目"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部科目</SelectItem>
              {uniqueSubjects.map(sub => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>


          {/* 能力指標 */}
          <span className="text-sm">能力指標：</span>
          <Select
            value={selectedIndicator}
            onValueChange={setSelectedIndicator}
          >
            <SelectTrigger className="w-[800x] focus:ring-0 font-medium text-slate-700 bg-white border rounded">
              <SelectValue placeholder="選擇能力指標"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部能力指標</SelectItem>
              {availableIndicators.map(ind => (
                <SelectItem key={ind} value={ind}>{ind}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 總覽練習狀況 */}
          <button
            onClick={runOverviewAI}
            disabled={geminiLoading}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition shadow-sm
              ${
                geminiLoading
                  ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-700"
              }
            `}
          >
            {geminiLoading ? (
              <>
                <span className="animate-spin"></span>
                分析中…
              </>
            ) : (
              <>
                總覽練習狀況
              </>
            )}
          </button>

        </div>
      </div>

        {/* 資料期間顯示 */}
        <div className="flex justify-end px-4 -mt-1">
          <span className="text-xs text-slate-400">
            {periodLabel}
          </span>
        </div>


      {/* 2. KPI Cards  */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: 次數 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            總練習次數
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-3xl font-black text-slate-700 tracking-tight">
              {processedStats.count.toLocaleString()}
            </div>
            
            <div className="gap-2 mt-2 text-center  font-medium">
              <span className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                全校練習：{processedStats.userCount}人
              </span><br/>
              <span className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                全校人均練習：{processedStats.schoolAvgCount}次
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: 時間 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            平均投入時間
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-2xl font-black text-slate-700 tracking-tight">
              {processedStats.totalTime} <span className="text-base">秒</span>
            </div>
            {avgSpeedCompare.classAvgSec != null && (
              <div className="text-[11px] text-center mt-1 font-medium">
                <span className="text-slate-500">校平均 {avgSpeedCompare.classAvgSec} 秒</span><br/>
                <span className={`ml-1 ${
                  Number(avgSpeedCompare.diff) < 0 ? "text-green-500" : "text-red-500"
                }`}>
                  {Number(avgSpeedCompare.diff) === 0 ? " (→)" : 
                  Number(avgSpeedCompare.diff) < 0 ? ` (快 ${Math.abs(Number(avgSpeedCompare.diff))}s)` : ` (慢 ${Math.abs(Number(avgSpeedCompare.diff))}s)`}
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
            <div className="text-[11px] text-slate-400 font-medium mt-1">
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
            指標表現狀態
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className={`text-2xl font-black tracking-tight ${
              belowClassAvgStats.count > 0 ? "text-red-500" : "text-blue-600"
            }`}>
              {belowClassAvgStats.count > 0 ? "需加強" : "表現良好"}
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
            目標完成率
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className={`text-2xl font-black tracking-tight ${
              processedStats.reachedGoal ? "text-blue-600" : "text-red-500"
            }`}>
              {processedStats.reachedGoal ? "100.00%" : "尚未達成"}
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
              區塊一（3張圖表）
      ========================= */}
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
            <CardTitle className="text-xl font-bold ">
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

          <CardContent className="h-[300px] w-full">
            <Plot
              data={[
                {
                  x: chart1Data.xShort, 
                  y: chart1Data.yBar,
                  type: "bar",
                  name: "練習次數",
                  marker: { color: "#bfdbfe" },
                  opacity: 0.8,
                  customdata: chart1Data.xFull, 
                  hovertemplate:
                    "<b>%{x}</b><br><b>%{customdata}</b><br>練習次數：%{y}<extra></extra>", 
                  hoverlabel: {
                    align: "left",    // 文字靠左
                    font: { size: 13}
                  }
                },
                {
                  x: chart1Data.xShort,
                  y: chart1Data.yLine,
                  type: "scatter",
                  mode: "lines+markers",
                  name: "平均正確率 (%)",
                  yaxis: "y2",
                  marker: { color: "#2563eb", size: 8 },
                  line: { width: 3 },
                  hovertemplate:
                    "<b>%{customdata}</b><br>平均正確率：%{y}%<extra></extra>",
                  customdata: chart1Data.xFull,
                  hoverlabel: {
                    align: "left",    // 文字靠左
                    font: { size: 13}
                  }
                },
              ]}
              layout={{
                height: 300,
                margin: { t: 60, r: 40, b: 80, l: 40 },
                xaxis: {
                  tickangle: -30,
                  tickfont: { size: 11 },
                },

                yaxis: {
                  title: "練習次數",
                  gridcolor: "#f1f5f9",
                  zeroline: false,
                },

                yaxis2: {
                  title: "平均正確率 (%)",
                  overlaying: "y",
                  side: "right",
                  range: [0, 110],
                  showgrid: false,
                },

                /* 正確率基準線 */
                shapes:
                  avgScoreCompare.classAvg !== null
                    ? [
                        {
                          type: "line",
                          xref: "paper",
                          x0: 0,
                          x1: 1,
                          yref: "y2",
                          y0: avgScoreCompare.classAvg,
                          y1: avgScoreCompare.classAvg,
                          line: {
                            color: "#ef4444",
                            width: 2,
                            dash: "dash",
                          },
                        },
                      ]
                    : [],

                annotations:
                  avgScoreCompare.classAvg !== null
                    ? [
                        {
                          xref: "paper",
                          x: 1,
                          yref: "y2",
                          y: avgScoreCompare.classAvg,
                          text: `校平均 ${avgScoreCompare.classAvg}%`,
                          showarrow: false,
                          font: { size: 11, color: "#ef4444" },
                          xanchor: "right",
                          yanchor: "bottom",
                        },
                      ]
                    : [],



                legend: {
                  orientation: "h",
                  yanchor: "bottom",
                  y: 1.1, 
                  xanchor: "center",
                  x: 0.5,
                  font: { size: 11 }
                },

                font: { family: "inherit" },
              }}
              
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </CardContent>
        </Card>

        
        {/* ===== 圖表 2：學習歷程表現圖 ===== */}
        <Card className="col-span-1 relative">
          
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

        <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
            {/* 左側：標題 */}
            <CardTitle className="text-xl font-bold ">
              學習歷程表現
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
                          <li><b>圓點：</b>學生在該指標上每一次練習的紀錄。</li>
                          <li><b>答題速度（X軸）：</b>往左代表思考愈快，往右代表你花比較多時間仔細推敲。</li>
                          <li><b>正確率 (Y軸)：</b>愈往上代表答對的情況愈好。</li>
                        </ul>
                        <p className="text-[12px] text-slate-400 pt-1 border-t">
                          ※ 透過此圖可以觀察你在該科目/能力指標上反應速度與準確度關係。
                        </p>
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
              <button
                onClick={() => runAIForChart("learning_process")}
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

          
          

          <CardContent className="h-[300px]">
            <Plot
              data={[
                // ===== 歷次作答 =====
                {
                  x: chart3Data.x,
                  y: chart3Data.y,
                  mode: "markers+text",
                  type: "scatter",
                  text: chart3Data.attemptIndex.map(String),
                  textposition: "top center",
                  marker: {
                    size: 14,
                    color: chart3Data.zone.map(z => ZONE_COLOR[z]),
                    opacity: 0.85,
                    line: { color: "white", width: 2 },
                  },
                  hovertemplate:
                    "<b>第%{text}次</b>" +
                    "<br>作答時間：%{x:.1f} 秒" +
                    "<br>正確率：%{y:.0f}%" +
                    "<br><b>%{customdata}</b>" +
                    "<extra></extra>",
                  customdata: chart3Data.zone,
                  name: "歷次作答",
                },

                // ===== 最新一次作答（黃框） =====
                {
                  x: chart3Data.x.filter((_, i) => chart3Data.isLatest[i]),
                  y: chart3Data.y.filter((_, i) => chart3Data.isLatest[i]),
                  mode: "markers",
                  type: "scatter",
                  marker: {
                    size: 15,
                    color: "rgba(255, 255, 255, 0.1)",
                    line: {
                      color: "#f4f800ff",
                      width: 2,
                    },
                  },
                  hoverinfo: "skip",
                  name: "最近一次作答",
                },
              ]}
              layout={{
                height: 300,
                margin: { t: 20, r: 20, b: 70, l: 40 }, 
                

                xaxis: {
                    title: {
                    text: "平均每題作答時間（秒）", // X 軸數值名稱
                    font: { size: 10, color: '#64748b' },
                    standoff: 15
                  },
                  gridcolor: "#f1f5f9",
                },

                yaxis: {
                  title: {
                    text: "正確率 (%)", // Y 軸數值名稱
                    font: { size: 10, color: '#64748b' },
                    standoff: 15
                  },
                  range: [0, 115],
                  tickformat: ",.0f",
                  gridcolor: "#f1f5f9",
                },

                shapes: [
                  // 正確率門檻
                  {
                    type: "line",
                    x0: 0,
                    x1: 1,
                    xref: "paper",
                    y0: chart3Data.passScore,
                    y1: chart3Data.passScore,
                    line: { color: "#94a3b8", width: 1, dash: "dot" },
                  },
                  // 中位作答時間
                  {
                    type: "line",
                    x0: chart3Data.medianTimeSec,
                    x1: chart3Data.medianTimeSec,
                    y0: 0,
                    y1: 100,
                    line: { color: "#94a3b8", width: 1, dash: "dot" },
                  },
                ],

                annotations: [
                  { x: chart3Data.medianTimeSec * 0.6, y: 85, text: "<b>精熟區</b>", showarrow: false, font: { color: "#22c55e" } },
                  { x: chart3Data.medianTimeSec * 1.4, y: 85, text: "<b>穩定區</b>", showarrow: false, font: { color: "#3b82f6" } },
                  { x: chart3Data.medianTimeSec * 0.6, y: 20, text: "<b>猜測區</b>", showarrow: false, font: { color: "#f97316" } },
                  { x: chart3Data.medianTimeSec * 1.4, y: 20, text: "<b>卡關區</b>", showarrow: false, font: { color: "#ef4444" } },
                ],

                legend: {
                  orientation: "h",
                  y: -0.3,
                },
              }}
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
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
              <CardTitle className="text-xl font-bold ">
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



        <CardContent className="h-[300px]">
          <Plot
            data={[
              // 第一組：個人歷次平均（相對於校平均的差距）
              {
                type: "bar",
                orientation: "h",
                name: "個人歷次平均",
                // 這裡 x 軸請對應您在 diffBarData 算出的 avgDiff
                x: diffBarData.map(d => d.avgDiff),
                y: diffBarData.map(d => d.indicator),
                marker: {
                  color: "#a7afb9ff", // 建議使用中性的灰色，代表歷史背景參考
                },
                text: diffBarData.map(d => `${d.avgDiff >= 0 ? "+" : ""}${d.avgDiff}%`),
                textposition: "inside", // 放在條形內部，避免干擾最新成績的數值
                customdata: diffBarData.map(d => [
                  d.indicate_name, 
                  d.historicalAvg, // [1] 個人平均原值
                  d.classAvg       // [2] 校平均原值
                ]),
                hovertemplate:
                  "<b>%{y} - %{customdata[0]}</b><br>" +
                  "個人平均：%{customdata[1]}%<br>" +
                  "全校平均：%{customdata[2]}%<br>" +
                  "歷史差距：%{x}%<extra></extra>",
                hoverlabel: { align: "left", font: { size: 13 } }
              },
              // 第二組：個人最新表現（相對於校平均的差距）
              {
                type: "bar",
                orientation: "h",
                name: "最新一次表現",
                // 這裡 x 軸請對應您在 diffBarData 算出的 latestDiff
                x: diffBarData.map(d => d.latestDiff),
                y: diffBarData.map(d => d.indicator),
                marker: {
                  // 根據最新差距決定顏色：綠色代表領先校平均，紅色代表落後
                  color: diffBarData.map(d => (d.latestDiff >= 0 ? "#16a34a" : "#dc2626")),
                },
                text: diffBarData.map(d => `${d.latestDiff >= 0 ? "+" : ""}${d.latestDiff}%`),
                textposition: "inside", // 放在外部，強調目前的精熟狀態
                customdata: diffBarData.map(d => [
                  d.indicate_name, 
                  d.latestScore, // [1] 最新得分原值
                  d.classAvg     // [2] 校平均原值
                ]),
                hovertemplate:
                  "<b>%{y} - %{customdata[0]}</b><br>" +
                  "最新表現：%{customdata[1]}%<br>" +
                  "全校平均：%{customdata[2]}%<br>" +
                  "目前差距：%{x}%<extra></extra>",
                hoverlabel: { align: "left", font: { size: 13 } }
              },
            ]}
            layout={{
              autosize: true,
              // 啟用分組模式並調整間距
              barmode: "group", 
              bargap: 0.15,      // 不同指標間的間距
              bargroupgap: 0.05, // 同指標兩根條形間的間距
              
              // 增加 margin t 以便放下圖例
              margin: { l: 80, r: 60, t: 50, b: 40 },

              // 顯示圖例 (Legend)
              showlegend: true,
              legend: {
                orientation: "h", // 橫向排列
                yanchor: "bottom",
                y: 1.05,          // 放在圖表正上方
                xanchor: "right",
                x: 1,
                font: { size: 10 }
              },

              xaxis: {
                title: "與校平均差距（%）",
                zeroline: true,
                zerolinewidth: 2,
                zerolinecolor: "#94a3b8",
                gridcolor: "#f1f5f9",
                // 確保 0 基準線左右對稱或動態調整
                range: [
                  Math.min(...diffBarData.flatMap(d => [d.latestDiff, d.avgDiff])) - 15,
                  Math.max(...diffBarData.flatMap(d => [d.latestDiff, d.avgDiff])) + 15
                ]
              },

              yaxis: {
                automargin: true,
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
                  y: 1.02,
                  yref: "paper",
                  text: "校平均",
                  showarrow: false,
                  font: { size: 11, color: "#64748b", weight: "bold" },
                  xanchor: "center",
                },
              ],

              font: { family: "inherit" },
            }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
            config={{ displayModeBar: false, responsive: true }}
          />
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
    


    <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
      {/* 詳細練習紀錄 */}
      <Card className="col-span-1 shadow-sm relative overflow-hidden">

        {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

        <CardHeader className="flex flex-row items-center justify-between py-4 pb-2">
          <CardTitle className="text-xl font-bold text-slate-700">
            詳細練習紀錄 
            <span className="px-2 text-xs text-blue-600">（ {selectedSubject} | {selectedIndicator} ）</span>
           
            </CardTitle>
          <CardDescription></CardDescription>
        </CardHeader>

        <CardContent className="p-0 pt-2">
          <div className="max-h-[350px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-xs text-slate-500 border-b">
                  <th className="p-3 px-8 w-60 ">練習日期</th>
                  
                  {Array.from({ length: maxItemCount }).map((_, i) => (
                    <th key={i} className="p-3 w-40 text-center">
                      題目 {i + 1}
                    </th>
                  ))}
                  <th className="p-3 w-40 text-center">平均每題(ms)</th>
                  <th className="w-40 text-center">正確率</th>
                </tr>
              </thead>

              <tbody>
                {detailedRows.map((row) => (
                  <tr key={row.prac_answer_sn} className="border-t">
                    <td className="px-4 py-2 font-mono">
                      {formatDateTime(row.date)}
                    </td>



                    {Array.from({ length: maxItemCount }).map((_, i) => {
                      const item = row.items[i];
                      return (
                        <td key={i} className="text-center">
                          {item ? (
                            item.is_correct ? (
                              <span className="text-green-600 font-bold">✔</span>
                            ) : (
                              <span className="text-red-600 font-bold">✘</span>
                            )
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2 text-center font-base">
                      {Math.round(row.avg_item_time_ms)}
                    </td>

                    <td className="px-3 py-2 text-center">
                      <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${
                            row.score_rate >= 80
                              ? "bg-blue-100 text-blue-700"
                              : row.score_rate < 40
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                        {Math.round(row.score_rate)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>


      
    </div>
  );
}


