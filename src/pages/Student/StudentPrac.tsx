import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import { supabase } from "@/lib/supabase";
import { useUserContext } from "@/contexts/UserContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generatePracSuggestion } from "@/lib/ai/pracActionAdvisor";
import { 
  ArrowLeft, 
  Filter, 
  Activity, 
  BarChart2,
  Target, 
  Clock, 
  TrendingUp,
  Zap,
  AlertTriangle,
  CheckCircle2 
} from "lucide-react";
import _ from "lodash"; 

/* =========================
   Types Definitions
   ========================= */

interface DailyRow {
  user_sn: string;
  activity_date: string; 
  d_prac_count: number;
  d_learn_time_sec: number;
  d_avg_score_rate: number;
  d_avg_efficiency: number;
  d_total_wrong: number;
}

interface AttemptRow {
  prac_sn: number;
  user_sn: number;
  activity_date: string;
  date: string; 
  subject_name: string;
  indicator_name: string;
  during_time: number;
  score_rate: number;
  items_count: number;
  avg_item_time_ms: number;
}

interface IndicatorRow {
  user_sn: number;
  indicator_name: string;
  in_prac_count: number;
  in_avg_score_rate: number;
}

interface ClassIndicatorRow {
  subject_name: string;
  indicator_name: string;
  participant_count: number;
  class_avg_score_rate: number; 
  class_prac_count: number;
  class_avg_time_sec: number;
}

interface PracItemRow {
  prac_sn: number;
  user_sn: number;
  date: string;
  activity_date: string;
  indicator_name: string;
  item_index: number;
  is_correct: number; // 1 / 0
  ans_time_ms: number;
}

interface PracDetailRow {
  prac_sn: number;
  date: string;
  items: PracItemRow[];
  avg_item_time_ms: number;
  score_rate: number; // 0–100
}

type DiffBarRow = {
  indicator_name: string;
  studentAvg: number;
  classAvg: number;
  diff: number;
};



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
  const [classIndicatorData, setClassIndicatorData] = useState<ClassIndicatorRow[]>([]);
  const [pracItems, setPracItems] = useState<PracItemRow[]>([]);
  const [loading, setLoading] = useState(true);


  // Filters
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedIndicator, setSelectedIndicator] = useState<string>("all");

  // AI
  const [showAI, setShowAI] = useState(false);


  /* =========================
     Data Fetching
     ========================= */
  useEffect(() => {
    const fetchData = async () => {
      if (!userSn) return;
      setLoading(true);

      // 1. Fetch Daily
      const setDailyReq = supabase
        .from("dp001_prac_daily")
        .select("*")
        .eq("user_sn", userSn)
        .order("activity_date", { ascending: true });

      // 2. Fetch Attempts
      const attemptsReq = supabase
        .from("dp001_prac_attempts")
        .select("*")
        .eq("user_sn", userSn)
        .order("date", { ascending: true });

      // 3. Fetch Indicator
      const indicatorReq = supabase
        .from("dp001_prac_indicator_summary")
        .select("*")
        .eq("user_sn", userSn);

      // 4. Fetch class Attempts
      const classIndicatorReq = supabase
      .from("dp001_prac_class_attempts")
      .select("subject_name, indicator_name, class_avg_score_rate, participant_count, class_prac_count, class_avg_time_sec")
      .eq("organization_id", organizationId)
      .eq("grade", gradeId)
      .eq("class", classId);

      // 5. fetch item
      const itemsReq = supabase
        .from("dp001_prac_items")
        .select("*")
        .eq("user_sn", userSn)
        .order("date", { ascending: true });


      const [DailyRes, attemptsRes, indicatorRes, classIndicatorRes, items] =
        await Promise.all([setDailyReq, attemptsReq, indicatorReq, classIndicatorReq, itemsReq]);

      if (attemptsRes.error) console.error("Error fetching attempts:", attemptsRes.error);
      
      setDailyData((DailyRes.data as DailyRow[]) || []);
      setAttemptsData((attemptsRes.data as AttemptRow[]) || []);
      setIndicatorData((indicatorRes.data as IndicatorRow[]) || []);
      setClassIndicatorData(classIndicatorRes.data || []);
      setPracItems((items.data as PracItemRow[]) || []);
      setLoading(false);
    };

    fetchData();
  }, [userSn]);

  /* =========================
     Data Processing 
     ========================= */

  /* =========================
     日期篩選
     ========================= */
  
  /* Prac view */
  const filteredDailyRows = useMemo(() => {
    const { start, end } = dateRange;

    return dailyData.filter((r) => {
      const d = r.activity_date;

      // start/end 可能是空字串
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [dailyData, dateRange]);

  const activeDailyRows = useMemo(() => {
  if (!selectedDate) return filteredDailyRows;
  return filteredDailyRows.filter(r => r.activity_date === selectedDate);
  }, [filteredDailyRows, selectedDate]);


  const practice_kpi = useMemo(() => {
  if (!activeDailyRows.length) {
    return { totalPrac: 0, totalTimeMin: 0, avgScore: 0 };
  }

  return {
    totalPrac: activeDailyRows.reduce((s, r) => s + r.d_prac_count, 0),
    totalTimeMin: Math.round(
      activeDailyRows.reduce((s, r) => s + r.d_learn_time_sec, 0) / 60
    ),
    avgScore: Math.round(
      activeDailyRows.reduce((s, r) => s + r.d_avg_score_rate, 0) /
        activeDailyRows.length
    ),
  };
}, [activeDailyRows]);


  /* Platform */
  const yMax = useMemo(() => {
    const timeValues = filteredDailyRows.map((r) => r.d_learn_time_sec / 60);
    return timeValues.length > 0 ? Math.max(...timeValues) * 1.1 : 100;
  }, [filteredDailyRows]);

  // 1. 取得所有科目清單
  const uniqueSubjects = useMemo(() => {
    return _.uniq(attemptsData.map(d => d.subject_name)).sort();
  }, [attemptsData]);

  // 2. 根據篩選器過濾資料
  const filteredAttempts = useMemo(() => {
  return attemptsData.filter(d => {
    if (selectedSubject !== "all" && d.subject_name !== selectedSubject)
      return false;
    if (selectedIndicator !== "all" && d.indicator_name !== selectedIndicator)
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

    return _.uniq(base.map(d => d.indicator_name)).sort();
  }, [attemptsData, selectedSubject]);

  const filteredPracItems = useMemo<PracItemRow[]>(() => {
  return pracItems.filter(i => {
    if (selectedIndicator !== "all" && i.indicator_name !== selectedIndicator)
      return false;
    return true;
  });
}, [pracItems, selectedIndicator]);


  const detailedRows = useMemo<PracDetailRow[]>(() => {
  if (filteredPracItems.length === 0) return [];

  const byPrac: Record<number, PracItemRow[]> = _.groupBy(
    filteredPracItems,
    "prac_sn"
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
      prac_sn: first.prac_sn,
      date: first.date,
      items, 
      avg_item_time_ms: avgTime,
      score_rate: (correctCount / totalCount) * 100,
    };
  }).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}, [filteredPracItems]);

 
  const maxItemCount = useMemo(() => {
    return Math.max(0, ...detailedRows.map((r) => r.items.length));
  }, [detailedRows]);
  

  
   //圓餅圖
  const subjectPieData = useMemo(() => {
  if (!attemptsData.length) return [];

  const base: AttemptRow[] = selectedDate
    ? attemptsData.filter(a => a.activity_date === selectedDate)
    : attemptsData;

  const grouped: Record<string, AttemptRow[]> =
    _.groupBy(base, "subject_name");

  return Object.entries(grouped).map(([subject, rows]) => ({
    subject,
    count: rows.length,
  }));
  }, [attemptsData, selectedDate]);

  const pieLabels = subjectPieData.map(d => d.subject);
  const pieOpacity = pieLabels.map(label =>
    selectedSubject === "all"
      ? 1
      : label === selectedSubject
      ? 1        // 被選中：正常顯示
      : 0.25     // 其他：變淡
  );



  // 3. KPI 與 最新狀態
  const processedStats = useMemo(() => {
  const totalCount = filteredAttempts.length;
  const totalTime = _.sumBy(filteredAttempts, "during_time");

  const avgScore =
    totalCount > 0 ? _.meanBy(filteredAttempts, "score_rate") : 0;

  const avgSpeedSec =
    totalCount > 0
      ? (_.meanBy(filteredAttempts, "avg_item_time_ms") / 1000).toFixed(1)
      : "0.0";

  const attemptsByIndicator = _.groupBy(
    filteredAttempts,
    "indicator_name"
  );

  let improvedCount = 0; // 曾低分 → 現在進步
  let perfectCount = 0;  // 一開始就 100%
  let struggleCount = 0; // 目前仍低分

  const PASS_SCORE = 0.6;     // 及格線（60%）
  const GOAL_SCORE = 0.8;    // 學習目標（80%）
  const PERFECT_SCORE = 0.99;

  Object.values(attemptsByIndicator).forEach((attempts) => {
    const sorted = _.orderBy(attempts, ["date"], ["asc"]);
    if (!sorted.length) return;

    const first = sorted[0];
    const latest = sorted[sorted.length - 1];

    const firstScore = first.score_rate;
    const latestScore = latest.score_rate;

    const wasLowBefore = sorted.some(a => a.score_rate < PASS_SCORE);
    const isImproved = wasLowBefore && latestScore >= GOAL_SCORE;
    const isPerfectNow = latestScore >= PERFECT_SCORE;
    const isStillStruggling = latestScore < PASS_SCORE;

    if (isStillStruggling) struggleCount++;
    if (isImproved) improvedCount++;
    if (isPerfectNow) perfectCount++;
  });


  const reachedGoal =
  struggleCount === 0 &&
  (improvedCount > 0 || perfectCount > 0);


  return {
    count: totalCount,
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
const belowClassAvgStats = useMemo(() => {
  if (!filteredAttempts.length || !classIndicatorData.length) {
    return {
      count: 0,
      classPracPeople: null,
    };
  }

  // ① 每個能力指標只取「最新一次作答」
  const latestByIndicator = _.mapValues(
    _.groupBy(filteredAttempts, "indicator_name"),
    arr => _.maxBy(arr, "date")
  );

  let count = 0;

  // ② 計算「低於班級平均的能力指標數」
  Object.values(latestByIndicator).forEach((latest: any) => {
    if (!latest) return;

    const classRow = classIndicatorData.find(
      c =>
        c.subject_name === latest.subject_name &&
        c.indicator_name === latest.indicator_name
    );

    if (!classRow) return;

    if (latest.score_rate < classRow.class_avg_score_rate) {
      count++;
    }
  });

  // ③ 班級練習人數：只取一次（不依 indicator）
  const classPracPeople =
    classIndicatorData.length > 0
      ? Math.max(...classIndicatorData.map(c => c.participant_count || 0))
      : null;

  return {
    count,
    classPracPeople,
  };
}, [filteredAttempts, classIndicatorData]);



  //班級平均秒數
  const avgSpeedCompare = useMemo(() => {
  if (!filteredAttempts.length || !classIndicatorData.length) {
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
      classIndicatorData.find(
        c =>
          c.subject_name === a.subject_name &&
          c.indicator_name === a.indicator_name &&
          c.class_avg_time_sec !== null
      )
    )
    .filter(Boolean) as ClassIndicatorRow[];

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
  }, [filteredAttempts, classIndicatorData]);




  // 4. Indicator 列表 (用於圖表一、三)
  const filteredIndicators = useMemo(() => {
    if (selectedSubject === "all") return indicatorData;
    const activeNames = new Set(filteredAttempts.map(d => d.indicator_name));
    return indicatorData.filter(d => activeNames.has(d.indicator_name));
  }, [indicatorData, filteredAttempts, selectedSubject]);

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
      xShort: sorted.map((_, idx) =>
        makeShortLabel(_.indicator_name, idx)
      ),
      xFull: sorted.map(d => d.indicator_name),
      yBar: sorted.map(d => d.in_prac_count),
      yLine: sorted.map(d =>
        Math.round(d.in_avg_score_rate)
      ),
      // 分析用 metadata（後面四象限會直接用）
      meta: sorted.map(d => ({
        indicator_name: d.indicator_name,
        prac_count: d.in_prac_count,
        avg_score: Math.round(d.in_avg_score_rate),
        total_items: d.in_total_items,
        total_wrong: d.in_total_wrong,
      })),
    };
  }, [filteredIndicators]);

  const chart1ClassAvgScore = useMemo(() => {
  if (!chart1Data.xFull.length || !classIndicatorData.length) return null;

  // 取出 chart1 使用到的指標名稱
  const indicatorsInChart = new Set(chart1Data.xFull);

  // 找到班級中「相同科目＋相同指標」的資料
  const matched = classIndicatorData.filter(
    c =>
      indicatorsInChart.has(c.indicator_name) &&
      (selectedSubject === "all" || c.subject_name === selectedSubject)
  );

  if (!matched.length) return null;

  // 班級在這些指標的平均正確率
  return _.meanBy(matched, "class_avg_score_rate");
  }, [chart1Data, classIndicatorData, selectedSubject]);

  

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

    const attemptsWithIndex = _.flatMap(
      _.groupBy(filteredAttempts, "indicator_name"),
      (attempts) => {
        const sorted = _.orderBy(attempts, ["date"], ["asc"]);
        return sorted.map((a, idx) => ({
          ...a,
          attemptIndex: idx + 1,
          totalAttempts: sorted.length,
          isLatest: idx === sorted.length - 1,
        }));
      }
    );

    const validPoints = attemptsWithIndex.filter(
      d => d.items_count >= 1
    );

    // ms → 秒
    const timeSecValues = validPoints.map(d => d.avg_item_time_ms / 1000);
    const medianTimeSec = calculateMedian(timeSecValues) || 5;
    const passScore = 60;

    const zoneOf = (d: any) => {
      const acc = d.score_rate;
      const timeSec = d.avg_item_time_ms / 1000;

      if (acc >= passScore && timeSec <= medianTimeSec) return "精熟區";
      if (acc >= passScore && timeSec > medianTimeSec) return "穩定區";
      if (acc < passScore && timeSec <= medianTimeSec) return "猜測區";
      return "卡關區";
    };

    return {
      x: validPoints.map(d => d.avg_item_time_ms / 1000), // 秒
      y: validPoints.map(d => d.score_rate),       // %
      text: validPoints.map(
        d =>
          `${d.indicator_name}` +
          `<br>第 ${d.attemptIndex} 次測驗` +
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
          indicator_name: d.indicator_name
        })),
        d => `${d.subject_name}__${d.indicator_name}`
      );
    }, [filteredAttempts]);

    
    const matchedClassIndicators = useMemo(() => {
      if (!classIndicatorData.length) return [];

      return activeIndicators
        .map(({ subject_name, indicator_name }) => {
          const classRow = classIndicatorData.find(
            c =>
              c.subject_name === subject_name &&
              c.indicator_name === indicator_name
          );

          return classRow
            ? {
                subject_name,
                indicator_name,
                class_avg_score_rate: classRow.class_avg_score_rate
              }
            : null;
        })
        .filter(Boolean);
    }, [activeIndicators, classIndicatorData]);

    
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

  //圖表三：差距條形圖資料（學生 vs 班級）
  const diffBarData = useMemo<DiffBarRow[]>(() => {
  if (!filteredAttempts.length || !matchedClassIndicators.length) return [];

  // 每個能力指標的學生平均
  const studentByIndicator: Record<string, number> = _.mapValues(
    _.groupBy(filteredAttempts, "indicator_name"),
    rows => _.meanBy(rows, "score_rate")
  );

  const rows: DiffBarRow[] = [];

  Object.entries(studentByIndicator).forEach(
    ([indicator_name, studentAvg]) => {
      const classRow = matchedClassIndicators.find(
        c => c.indicator_name === indicator_name
      );

      if (!classRow) return;

      const classAvg = classRow.class_avg_score_rate;

      rows.push({
        indicator_name,
        studentAvg: Math.round(studentAvg),
        classAvg: Math.round(classAvg),
        diff: Math.round(studentAvg - classAvg),
      });
    }
  );

  // 低於班級的放後面
  return _.orderBy(rows, ["diff"], ["asc"]);
}, [filteredAttempts, matchedClassIndicators]);

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}
          ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

 //pracActionAdvisor
 const aiSuggestion = useMemo(() => {
  return generatePracSuggestion({
    avgScore: avgScoreCompare.studentAvg,
    avgSpeedSec: Number(processedStats.avgSpeedSec),
    belowClassCount: belowClassAvgStats.count,
    struggleCount: processedStats.struggleCount,
    reachedGoal: processedStats.reachedGoal,
  });
}, [
  avgScoreCompare,
  processedStats,
  belowClassAvgStats,
]);




  /* =========================
     Render
     ========================= */
  
  if (loading) return <div className="p-20 text-center flex items-center justify-center h-screen text-slate-500"><Activity className="animate-spin mr-2"/> 分析資料載入中...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== Practice Daily Card ===== */}
          <Card className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">每日練習表現投入 </h3>
          </div>

          {/* Main Content：Chart + KPI */}
              <Plot
                data={[
                  {
                    x: filteredDailyRows.map(r => r.activity_date),
                    y: filteredDailyRows.map(r => r.d_learn_time_sec / 60),
                    type: "bar",
                    name: "練習時間（分鐘）",
                    marker: {
                      color: filteredDailyRows.map(r =>
                        !selectedDate
                          ? "#60a5fa"
                          : r.activity_date === selectedDate
                          ? "#2563eb"   // 被選中的：深藍
                          : "#93c5fd"   // 其他：淡藍
                      ),
                      opacity: filteredDailyRows.map(r =>
                        !selectedDate || r.activity_date === selectedDate ? 0.9 : 0.35
                      ),
                    },
                    hovertemplate:
                      "日期：%{x}<br>" +
                      "練習時間：%{y:.1f} 分鐘<extra></extra>",
                  },
                  {
                    x: filteredDailyRows.map(r => r.activity_date),
                    y: filteredDailyRows.map(r => r.d_avg_score_rate),
                    type: "scatter",
                    mode: "lines+markers",
                    name: "平均正確率（%）",
                    yaxis: "y2",
                    marker: { size: 8 },
                    line: { width: 3, color: "#f97316" },
                    hovertemplate:
                      "日期：%{x}<br>" +
                      "平均正確率：%{y}%<extra></extra>",
                  },
                ]}
                layout={{
                  autosize: true,
                  height: 260,
                  margin: { t: 20, l: 40, r: 40, b: 60 },
                  xaxis: {
                    type: "category",
                    tickangle: -30,
                    tickfont: { size: 10 },
                  },
                  yaxis: {
                    title: "練習時間（分鐘）",
                    range: [0, yMax],
                    showgrid: true,
                    zeroline: false,
                  },
                  yaxis2: {
                    title: "平均正確率（%）",
                    overlaying: "y",
                    side: "right",
                    range: [0, 110],
                    showgrid: false,
                  },
                  legend: { orientation: "h", y: -0.35 },
                }}
                onClick={(event) => {
                  const point = event.points?.[0];
                  if (!point) return;

                  const clickedDate = String(point.x);

                  setSelectedDate(prev =>
                    prev === clickedDate ? null : clickedDate
                  );
                }}

                style={{ width: "100%"}}
                config={{ responsive: true, displayModeBar: false }}
              />

            {/* ===== KPI Side Panel ===== */}

              <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-slate-500">總練習次數</p>
                <p className="text-3xl font-bold text-blue-600">
                  {practice_kpi.totalPrac}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">總練習時間</p>
                <p className="text-3xl font-bold text-blue-600">
                  {practice_kpi.totalTimeMin} 分
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">平均正確率</p>
                <p className="text-3xl font-bold text-blue-600">
                  {practice_kpi.avgScore}%
                </p>
              </div>
              </div>


              {/* 空資料提示 */}
              {filteredDailyRows.length === 0 && (
                <div className="text-center text-sm text-slate-500 pt-2">
                  此日期區間沒有練習紀錄
                </div>
              )}
        </Card>

        {/* ===== Subject Practice Pie ===== */}
        <Card className="p-6">
          {/* Header */}
            <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">科目練習比例</h3>
            <CardDescription>
              {selectedDate
                ? `${selectedDate} 各科目練習分布`
                : "整體各科目練習分布"}
            </CardDescription>
            </div>
      
          <CardContent className="h-[350px]">
            {subjectPieData.length === 0 ? (
              <div className="text-center text-sm text-slate-500 pt-10">
                該日期沒有練習紀錄
              </div>
            ) : (
              <Plot
                data={[
                  {
                    type: "pie",
                    labels: pieLabels,
                    values: subjectPieData.map(d => d.count),
                    hole: 0.45,
                    marker: {
                      opacity: pieOpacity,
                    },
                    textinfo: "label+percent",
                    hovertemplate:
                      "<b>%{label}</b><br>" +
                      "練習次數：%{value}<br>" +
                      "比例：%{percent}<extra></extra>",
                  },
                ]}
                layout={{
                  autosize: true,
                  showlegend: true,
                  legend: { orientation: "h", y: -0.15 },
                  margin: { t: 10, b: 40 },
                  font: { family: "inherit" },
                }}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: "100%", height: "100%" }}

                /* 科目篩選 */
                onClick={(event) => {
                  const clickedSubject = event.points?.[0]?.label;
                  if (!clickedSubject) return;

                  setSelectedSubject(prev =>
                    prev === clickedSubject ? "all" : String(clickedSubject)
                  );
                  setSelectedIndicator("all");
                }}
              />
            )}
          </CardContent>
        </Card>
        </div>


      
      {/* 1. Header & Filter */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
          <div className="p-2 text-slate-400">
            <Filter className="w-4 h-4"/>
          </div>

          {/* 科目 */}
          <Select
            value={selectedSubject}
            onValueChange={(val) => {
              setSelectedSubject(val);
              setSelectedIndicator("all");
            }}
          >
            <SelectTrigger className="w-[160px] border-none focus:ring-0 font-medium text-slate-700">
              <SelectValue placeholder="選擇科目"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有科目</SelectItem>
              {uniqueSubjects.map(sub => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>


          {/* 能力指標 */}
          <Select
            value={selectedIndicator}
            onValueChange={setSelectedIndicator}
          >
            <SelectTrigger className="w-[800x] border-none focus:ring-0 font-medium text-slate-700">
              <SelectValue placeholder="選擇能力指標"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有能力指標</SelectItem>
              {availableIndicators.map(ind => (
                <SelectItem key={ind} value={ind}>{ind}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* AI 學習助手按鈕 */}
          <button
            onClick={() => setShowAI((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg
                      bg-blue-600 text-white hover:bg-blue-700
                      transition shadow-sm"
          >
            AI 學習助手
          </button>
        </div>
      </div>

       

      {showAI && aiSuggestion && (
        <Card className="border-blue-500 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              AI 學習建議
            </CardTitle>
            <CardDescription>
              根據你目前的練習表現，自動產生的行動建議
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="text-sm text-slate-700">
              {aiSuggestion.explanation}
            </p>

            <ul className="list-disc pl-5 text-sm text-slate-600">
              {aiSuggestion.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>

            <div className="text-right">
              <button
                onClick={() => setShowAI(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                收起建議
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* KPI 1: 次數 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-sm font-medium">總練習次數</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{processedStats.count}</div>
          </CardContent>
        </Card>

        {/* KPI 2: 時間 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-sm font-medium">投入時間</CardTitle>
          </CardHeader>

          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {processedStats.totalTime} 秒
            </div>

            {avgSpeedCompare.classAvgSec != null && (
              <p className="text-xs text-slate-500">
                班級平均 {avgSpeedCompare.classAvgSec} 秒　
                <span
                  className={
                    Number(avgSpeedCompare.diff) < 0
                      ? "text-green-600"
                      : Number(avgSpeedCompare.diff) > 0
                      ? "text-red-600"
                      : "text-slate-400"
                  }
                >
                  (
                  {Number(avgSpeedCompare.diff) === 0
                    ? " — "
                    : Number(avgSpeedCompare.diff) < 0
                    ? `快 ${Math.abs(Number(avgSpeedCompare.diff))} 秒`
                    : `慢 ${Math.abs(Number(avgSpeedCompare.diff))} 秒`}
                  )
                </span>
              </p>
            )}
          </CardContent>
        </Card>


        {/* KPI 3: 平均正確率 */}
       <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
          <CardTitle className="text-sm font-medium">平均正確率</CardTitle>
        </CardHeader>

        <CardContent className="p-4 pt-0">
          <div className="text-2xl font-bold">
            {avgScoreCompare.studentAvg}%
          </div>

          {avgScoreCompare.classAvg !== null && (
            <p className="text-xs text-slate-500">
              班級平均 {avgScoreCompare.classAvg}%　
              <span
                className={
                  avgScoreCompare.diff >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                ({avgScoreCompare.diff >= 0 ? "+" : ""}
                {avgScoreCompare.diff}%)
              </span>
            </p>
          )}
        </CardContent>
      </Card>


        {/* KPI 4: 速度 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-sm font-medium">平均答題速度</CardTitle>
          </CardHeader>

          <CardContent className="space-y-1">
            <div className="text-2xl font-bold">
              {processedStats.avgSpeedSec} 秒
            </div>

            
          </CardContent>
        </Card>


        {/* KPI 5: 低於班級平均 */}
        <Card className={`${belowClassAvgStats.count > 0 ? "border-red-300 bg-red-50/50"
              : "border-green-300 bg-green-50/50"}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-sm font-medium">低於班級平均</CardTitle>
          </CardHeader>

          <CardContent className="space-y-1">
            <div 
            className={`text-2xl font-bold text-green-600 ${
              belowClassAvgStats.count > 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {belowClassAvgStats.count > 0 ? "是" : "否"}
            </div>

            <p className="text-xs text-slate-500">
              班級總練習人數 {belowClassAvgStats.classPracPeople} 人
            </p>
          </CardContent>
        </Card>


        {/* KPI 6：已達學習目標 */}
        <Card
          className={
            processedStats.reachedGoal
              ? "border-green-300 bg-green-50/50"
              : "border-red-300 bg-red-50/50"
          }
        >
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium">
              已達學習目標
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 pt-0 space-y-2">
            {/* 主狀態 */}
            <div
              className={`text-2xl font-bold ${
                processedStats.reachedGoal
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {processedStats.reachedGoal ? "是" : "否"}
            </div>

            {/* 說明 */}
            <div className="text-xs text-slate-600 space-y-1">
              <div>
                已克服弱點：
                <span className="font-medium text-slate-800 ml-1">
                  {processedStats.improvedCount}
                </span>
              </div>
              <div>
                練習已滿分：
                <span className="font-medium text-slate-800 ml-1">
                  {processedStats.perfectCount}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>


      </div>

      {/* 3. Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1 */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>能力指標投入成效</CardTitle>
            <CardDescription>
              長條代表累積練習次數，折線代表歷史平均正確率（依練習次數排序）。
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[420px] w-full">
            <Plot
              data={[
                {
                  x: chart1Data.xShort, 
                  y: chart1Data.yBar,
                  type: "bar",
                  name: "練習次數",
                  marker: { color: "#bfdbfe" },
                  opacity: 0.8,
                  hovertemplate:
                    "<b>%{customdata}</b><br>練習次數：%{y}<extra></extra>",
                  customdata: chart1Data.xFull, 
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
                },
              ]}
              layout={{
                autosize: true,
                margin: { l: 50, r: 50, t: 20, b: 100 },

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
                  range: [ 0, Math.max(100, Math.max(...chart1Data.yLine) + 10)],
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
                          text: `班級平均 ${avgScoreCompare.classAvg}%`,
                          showarrow: false,
                          font: { size: 11, color: "#ef4444" },
                          xanchor: "right",
                          yanchor: "bottom",
                        },
                      ]
                    : [],



                legend: {
                  orientation: "h",
                  y: 1.15,
                },

                font: { family: "inherit" },
              }}
              config={{ responsive: true }}
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
            />
          </CardContent>
        </Card>

        {/* Chart 2: Scatter  */}
        <Card>
          <CardHeader>
            <CardTitle>學習歷程表現</CardTitle>
            <CardDescription>
              每個點代表一次練習嘗試，可觀察多次練習是否帶來正確率提升。<br />
              X 軸：答題速度（秒）　Y 軸：正確率（%）
            </CardDescription>
          </CardHeader>

          <CardContent className="h-[350px]">
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
                    "<b>%{text}</b>" +
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
                autosize: true,
                margin: { l: 40, r: 20, t: 20, b: 40 },

                xaxis: {
                  title: "平均每題作答時間（秒）",
                  gridcolor: "#f1f5f9",
                },

                yaxis: {
                  title: "正確率 (%)",
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
            />
          </CardContent>
        </Card>

      

    <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
      {/* Chart 3: Radar */}
      {/* Chart X: 差距條形圖（學生 vs 班級） */}
      <Card>
        <CardHeader>
          <CardTitle>能力指標差距分析</CardTitle>
          <CardDescription>
            顯示學生在各能力指標相對於班級平均的差距（0 為班級平均）。
          </CardDescription>
        </CardHeader>

        <CardContent className="h-[420px]">
          <Plot
            data={[
              {
                type: "bar",
                orientation: "h",
                x: diffBarData.map(d => d.diff),
                y: diffBarData.map(d => d.indicator_name),
                marker: {
                  color: diffBarData.map(d =>
                    d.diff >= 0 ? "#16a34a" : "#dc2626"
                  ),
                },
                text: diffBarData.map(d =>
                  `${d.diff >= 0 ? "+" : ""}${d.diff}%`
                ),
                textposition: "inside",
                
                hovertemplate:
                  "<b>%{y}</b><br>" +
                  "學生平均：%{customdata[0]}%<br>" +
                  "班級平均：%{customdata[1]}%<br>" +
                  "差距：%{x}%<extra></extra>",
                customdata: diffBarData.map(d => [
                  d.studentAvg,
                  d.classAvg,
                ]),
              },
            ]}
            layout={{
              autosize: true,
              margin: { l: 80, r: 60, t: 20, b: 40 },

              xaxis: {
                title: "學生 − 班級平均（%）",
                zeroline: true,
                zerolinewidth: 2,
                zerolinecolor: "#94a3b8",
                gridcolor: "#f1f5f9",
              },

              yaxis: {
                automargin: true,
              },

              shapes: [
                {
                  type: "line",
                  x0: 0,
                  x1: 0,
                  yref: "paper",
                  y0: 0,
                  y1: 1,
                  line: {
                    color: "#000000ff",
                    width: 3,
                    dash: "dash",
                  },
                },
              ],

              annotations: [
                {
                  x: 0,
                  y: 1,
                  yref: "paper",
                  text: "班級平均",
                  showarrow: false,
                  font: { size: 11, color: "#64748b" },
                  yanchor: "bottom",
                },
              ],

              font: { family: "inherit" },
            }}
            config={{ responsive: true }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
        </CardContent>
      </Card>
      </div>
    </div>


    <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
      {/* 4. Detailed Table (保留歷史紀錄) */}
      {/* 詳細練習紀錄 */}
      <Card>
        <CardHeader>
          <CardTitle>詳細練習紀錄</CardTitle>
          <CardDescription>依時間排序作答狀況，可觀察進步軌跡</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">練習日期</th>
                  {Array.from({ length: maxItemCount }).map((_, i) => (
                    <th key={i} className="px-4 py-3 text-center">
                      題目 {i + 1}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">平均每題(ms)</th>
                  <th className="px-3 py-2 text-right">正確率</th>
                </tr>
              </thead>

              <tbody>
                {detailedRows.map((row) => (
                  <tr key={row.prac_sn} className="border-t">
                    <td className="px-3 py-2 font-mono">
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

                    <td className="px-3 py-2 text-right font-mono">
                      {Math.round(row.avg_item_time_ms)}
                    </td>

                    <td className="px-3 py-2 text-right">
                      <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${
                            row.score_rate >= 80
                              ? "bg-green-100 text-green-700"
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


