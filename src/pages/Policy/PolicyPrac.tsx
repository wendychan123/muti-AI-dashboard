import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { supabase } from "@/lib/supabase";
import dayjs from "dayjs";
import { buildPolicyPracPrompt } from "@/lib/ai/buildPolicyPracPrompt";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { HelpCircle, Bot, Filter, Activity } from "lucide-react";

interface CityTrendRow {
  city: string;
  activity_date: string;
  active_students: number;
  total_prac_count: number;
  avg_score_rate: number;
  school_score_std: number;
}

type SchoolRow = {
  organization_id: string;
  city: string;
  total_students: number;
};

type KPI = {
  total_students: number;
  avg_score_rate: number;
  avg_prac_per_student: number;
  school_score_std: number;
};

type KPICompare = {
  current: KPI;
  baseline: KPI;
};

type PolicyExplainTarget =
  | "overview"
  | "development_index"
  | "regional_gap"
  | "gap_trend"
  | "practice_trend"
  | "effect_trend";


export default function PolicyPrac() {
  /* =========================
     常數：顯示字串
  ========================= */
  const ALL_CITY = "全部縣市";
  const ALL_SUBJECT = "全部科目";

  /* =========================
     篩選狀態
  ========================= */
  const [selectedCity, setSelectedCity] = useState<string>(ALL_CITY);
  const [selectedSubject, setSelectedSubject] = useState<string>(ALL_SUBJECT);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
 

  /* =========================
     下拉資料
  ========================= */
  const [cityList, setCityList] = useState<string[]>([ALL_CITY]);
  const [citySummary, setCitySummary] = useState<{ city: string; total_students: number }[]>([]);
  const [subjectList, setSubjectList] = useState<string[]>([ALL_SUBJECT]);
  const [citySubjectSummary, setCitySubjectSummary] = useState<any[]>([]);
  const [citySummaryTable, setCitySummaryTable] = useState<any[]>([]);

  /* =========================
     圖表資料
  ========================= */
  const [trend, setTrend] = useState<CityTrendRow[]>([]);
  const [baselineTrend, setBaselineTrend] = useState<CityTrendRow[]>([]); 
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [loading, setLoading] = useState(false);

  /* =========================
     AI助手
  ========================= */
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiResult, setGeminiResult] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);


  /* =========================
     baseline：全縣市母數（比較用）
  ========================= */
  const totalStudentsAll = useMemo(() => {
  return citySummary.reduce(
    (sum, c) => sum + c.total_students,
    0
  );
}, [citySummary]);


  /* =========================
     目前選擇的縣市母數（KPI 用）
  ========================= */
  const totalStudentsBySelection = useMemo(() => {
  if (selectedCity === ALL_CITY) return totalStudentsAll;

  const row = citySummary.find(
    (c) => c.city === selectedCity
  );

  return row?.total_students ?? 0;
}, [selectedCity, citySummary, totalStudentsAll]);

  /* =========================
     初始化：城市 / 學校 / 科目 / 日期範圍
  ========================= */
  useEffect(() => {
  const init = async () => {
    // 城市
    const { data: cityData } = await supabase
      .from("city_summary")
      .select("city, total_students");

    if (cityData) {
      const uniq = Array.from(
        new Set(cityData.map((d) => d.city))
      ).sort();

      setCityList([ALL_CITY, ...uniq]);
      setCitySummary(
        cityData.map((r) => ({
          city: r.city,
          total_students: Number(r.total_students ?? 0),
        }))
      );
    }

    // 科目
    const { data: subjectData } = await supabase
      .from("city_subject_trend_daily")
      .select("subject_name");

    if (subjectData) {
      const uniqSubjects = Array.from(
        new Set(subjectData.map((s: any) => s.subject_name))
      )
        .filter(Boolean)
        .map(String)
        .sort();

      setSubjectList([ALL_SUBJECT, ...uniqSubjects]);
    }

    // 日期範圍初始化
    const tableName =
      selectedSubject === ALL_SUBJECT
        ? "city_trend_daily"
        : "city_subject_trend_daily";

    const { data: dateData } = await supabase
      .from(tableName)
      .select("activity_date")
      .order("activity_date", { ascending: true });

    if (dateData && dateData.length > 0) {
      setStartDate(dateData[0].activity_date);
      setEndDate(dateData[dateData.length - 1].activity_date);
    }

    // city_summary.csv
    const { data: citySumData } = await supabase
      .from("city_summary")
      .select("*");

    if (citySumData) {
      setCitySummaryTable(citySumData);
    }

    // city_subject_summary.csv
    const { data: citySubjectSumData } = await supabase
      .from("city_subject_summary")
      .select("*");

    if (citySubjectSumData) {
      setCitySubjectSummary(citySubjectSumData);
    }
  };

  init();
}, []);


  /* =========================
     查詢：目前條件 + baseline（全部縣市同區間）
  ========================= */
  useEffect(() => {
    const loadTrend = async () => {
      if (!startDate || !endDate) return;

      setLoading(true);

      try {
        // =============================
        // 決定查詢資料表
        // =============================
        const isAllSubject = selectedSubject === ALL_SUBJECT;

        const currentTable = isAllSubject
          ? "city_trend_daily"
          : "city_subject_trend_daily";

        const baselineTable = isAllSubject
          ? "city_trend_daily"
          : "subject_trend_daily";

        // =============================
        // 查詢目前條件資料
        // =============================
        let q = supabase
          .from(currentTable)
          .select("*")
          .gte("activity_date", startDate)
          .lte("activity_date", endDate);

        if (selectedCity !== ALL_CITY) {
          q = q.eq("city", selectedCity);
        }

        if (!isAllSubject) {
          q = q.eq("subject_name", selectedSubject);
        }

        const { data: currentData } = await q.order("activity_date", {
          ascending: true,
        });

        setTrend(currentData ?? []);

        // =============================
        // baseline 永遠是全部縣市
        // =============================
        let baseQuery = supabase
          .from(baselineTable)
          .select("*")
          .gte("activity_date", startDate)
          .lte("activity_date", endDate);

        if (!isAllSubject) {
          baseQuery = baseQuery.eq("subject_name", selectedSubject);
        }

        const { data: baseData } = await baseQuery.order(
          "activity_date",
          { ascending: true }
        );

        setBaselineTrend(baseData ?? []);
      } finally {
        setLoading(false);
      }
    };

    loadTrend();
  }, [selectedCity, selectedSubject, startDate, endDate]);

  /* =========================
     動態調整篩選項（科目依照縣市變動）
  ========================= */

  useEffect(() => {
  const loadSubjects = async () => {
    let q = supabase
      .from("city_subject_trend_daily")
      .select("subject_name");

    if (selectedCity !== ALL_CITY) {
      q = q.eq("city", selectedCity);
    }

    const { data } = await q;

    if (!data) return;

    const uniqSubjects = Array.from(
      new Set(data.map((s: any) => s.subject_name))
    )
      .filter(Boolean)
      .map(String)
      .sort();

    setSubjectList([ALL_SUBJECT, ...uniqSubjects]);

    // 如果目前選的科目不在新清單裡 → 重置
    if (
      selectedSubject !== ALL_SUBJECT &&
      !uniqSubjects.includes(selectedSubject)
    ) {
      setSelectedSubject(ALL_SUBJECT);
    }
  };

  loadSubjects();
}, [selectedCity]);

  /* =========================
     KPI 計算（目前選擇）
  ========================= */
  const kpiCurrent = useMemo<KPI | null>(() => {
  if (!trend.length) return null;

  const totalPrac = trend.reduce(
    (sum, r) => sum + (r.total_prac_count ?? 0),
    0
  );

  const avgScore =
    trend.reduce((sum, r) => sum + (r.avg_score_rate ?? 0), 0) / trend.length;

  const avgPracPerStudent =
    totalStudentsBySelection > 0
      ? totalPrac / totalStudentsBySelection
      : 0;

  // ===== 校際差距邏輯修正 =====
  let schoolStd: number | null = null;

  // 情境 1：全部科目 → 用 city_trend_daily
  if (selectedSubject === ALL_SUBJECT) {
    const cityRows =
      selectedCity === ALL_CITY
        ? trend
        : trend.filter((r) => r.city === selectedCity);

    const values = cityRows
      .map((r) => r.school_score_std)
      .filter((v) => v !== null && v !== undefined);

    schoolStd =
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
  }

  // 情境 2：單一科目 → 用 city_subject_summary
  else {
    const row = citySubjectSummary.find(
      (r) =>
        r.city === selectedCity &&
        r.subject_name === selectedSubject
    );

    schoolStd = row?.school_score_std ?? null;
  }

  return {
    total_students: totalStudentsBySelection,
    avg_score_rate: avgScore,
    avg_prac_per_student: avgPracPerStudent,
    school_score_std: schoolStd,   // 可能為 null
  };
}, [
  trend,
  totalStudentsBySelection,
  selectedCity,
  selectedSubject,
  citySubjectSummary,
  citySummaryTable,
]);

  /* =========================
     KPI 計算（baseline：全部縣市）
  ========================= */
  const kpiBaseline = useMemo<KPI | null>(() => {
  if (!baselineTrend.length) return null;

  const totalPrac = baselineTrend.reduce(
    (sum, r) => sum + (r.total_prac_count ?? 0),
    0
  );

  const avgScore =
    baselineTrend.reduce((sum, r) => sum + (r.avg_score_rate ?? 0), 0) /
    baselineTrend.length;

  const avgPracPerStudent =
    totalStudentsAll > 0 ? totalPrac / totalStudentsAll : 0;

  let schoolStd: number | null = null;

  if (selectedSubject === ALL_SUBJECT) {
    const values = baselineTrend
      .map((r) => r.school_score_std)
      .filter((v) => v !== null && v !== undefined);

    schoolStd =
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
  } else {
    const rows = citySubjectSummary.filter(
      (r) => r.subject_name === selectedSubject
    );

    const values = rows
      .map((r) => r.school_score_std)
      .filter((v) => v !== null && v !== undefined);

    schoolStd =
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
  }

  return {
    total_students: totalStudentsAll,
    avg_score_rate: avgScore,
    avg_prac_per_student: avgPracPerStudent,
    school_score_std: schoolStd,
  };
}, [
      baselineTrend,
      totalStudentsAll,
      selectedSubject,
      citySubjectSummary,
      citySummaryTable,
    ]);


  /* =========================
     KPI 比較
  ========================= */
  const kpiCompare = useMemo<KPICompare | null>(() => {
    if (!kpiCurrent || !kpiBaseline) return null;
    return { current: kpiCurrent, baseline: kpiBaseline };
  }, [kpiCurrent, kpiBaseline]);

  /* =========================
     工具：箭頭 ↑↓→ + 差值
  ========================= */
  const compareArrow = (current: number, baseline: number, eps = 1e-9) => {
    const diff = current - baseline;
    if (Math.abs(diff) <= eps) return { arrow: "→", diff, cls: "text-slate-500" };
    if (diff > 0) return { arrow: "↑", diff, cls: "text-emerald-600" };
    return { arrow: "↓", diff, cls: "text-rose-600" };
  };

  /* =========================
     趨勢變動判斷 
     - 提高 (current > base)：綠色 (Success)
     - 降低 (current < base)：紅色 (Warning)
     - 持平 (current == base)：不改色 (預設灰/白)
  ========================= */

  // 1. 正確率趨勢：
  const trafficLightForRate = (current: number, base: number) => {
    if (current > base) return "bg-emerald-50 border-emerald-200 ";
    if (current < base) return "bg-rose-50 border-rose-200 ";
    return "bg-slate-50 border-slate-200 text-slate-600"; 
  };

  // 2. 人均練習趨勢
  const trafficLightForPrac = (current: number, base: number) => {
    if (current > base) return "bg-emerald-50 border-emerald-200 ";
    if (current < base) return "bg-rose-50 border-rose-200 ";
    return "bg-slate-50 border-slate-200 ";
  };

  // 3. 校際差距趨勢 (差距越小 = 表現越均衡 = 綠色)
  const trafficLightForGap = (current: number, base: number) => {
    // 截圖中 1.74 < 2.42，代表差距在縮小，應為綠色
    if (current < base) return "bg-emerald-50 border-emerald-200 "; 
    if (current > base) return "bg-rose-50 border-rose-200 ";          
    return "bg-slate-50 border-slate-200 ";
  };

  /* =========================
     資料期間顯示
  ========================= */
  const periodLabel = useMemo(() => {
    if (!startDate || !endDate) return "資料期間：—";
    const s = dayjs(startDate).format("YYYY/MM/DD");
    const e = dayjs(endDate).format("YYYY/MM/DD");
    const days = dayjs(endDate).diff(dayjs(startDate), "day") + 1;
    return `篩選資料期間：${s} ～ ${e}（${days} 天）`;
  }, [startDate, endDate]);

  /* =========================
     日 / 週 / 月聚合資料（作答狀況）
  ========================= */
  const aggregatedTrend = useMemo(() => {
  if (!trend.length) return [];

  if (viewMode === "day") return trend;

  const map = new Map<string, {
    active_students: number;
    total_prac_count: number;
    count: number;
  }>();

  trend.forEach((t) => {
    const key =
      viewMode === "week"
        ? dayjs(t.activity_date).startOf("week").format("YYYY-MM-DD")
        : dayjs(t.activity_date).startOf("month").format("YYYY-MM-DD");

    if (!map.has(key)) {
      map.set(key, {
        active_students: 0,
        total_prac_count: 0,
        count: 0,
      });
    }

    const obj = map.get(key)!;
    obj.active_students += t.active_students ?? 0;
    obj.total_prac_count += t.total_prac_count ?? 0;
    obj.count += 1;
  });

  return Array.from(map.entries()).map(([date, value]) => ({
    activity_date: date,
    active_students: Math.round(value.active_students / value.count),
    total_prac_count: value.total_prac_count,
  }));
}, [trend, viewMode]);

/* =========================
     只顯示共同有日期資料
  ========================= */
  const commonDates = useMemo(() => {
  const cityDates = new Set(
    trend.map((t) =>
      dayjs(t.activity_date).format("YYYY-MM-DD")
    )
  );

  const baseDates = new Set(
    baselineTrend.map((t) =>
      dayjs(t.activity_date).format("YYYY-MM-DD")
    )
  );

  return Array.from(cityDates)
    .filter((d) => baseDates.has(d))
    .sort();
}, [trend, baselineTrend]);

const alignedCommonData = useMemo(() => {
  const cityMap = new Map(
    trend.map((t) => [
      dayjs(t.activity_date).format("YYYY-MM-DD"),
      t.avg_score_rate,
    ])
  );

  const baseMap = new Map(
    baselineTrend.map((t) => [
      dayjs(t.activity_date).format("YYYY-MM-DD"),
      t.avg_score_rate,
    ])
  );

  return commonDates.map((date) => ({
    date,
    city: cityMap.get(date) ?? null,
    base: baseMap.get(date) ?? null,
  }));
}, [commonDates, trend, baselineTrend]);

/* =========================
     日 / 週 / 月聚合資料（學習成效）
  ========================= */
const aggregatedScoreTrend = useMemo(() => {
  if (viewMode === "day") return alignedCommonData;

  const map = new Map<
    string,
    { citySum: number; baseSum: number; count: number }
  >();

  alignedCommonData.forEach((d) => {
    const key =
      viewMode === "week"
        ? dayjs(d.date).startOf("week").format("YYYY-MM-DD")
        : dayjs(d.date).startOf("month").format("YYYY-MM-DD");

    if (!map.has(key)) {
      map.set(key, {
        citySum: 0,
        baseSum: 0,
        count: 0,
      });
    }

    const obj = map.get(key)!;
    obj.citySum += d.city ?? 0;
    obj.baseSum += d.base ?? 0;
    obj.count += 1;
  });

  return Array.from(map.entries()).map(([date, v]) => ({
    date,
    city: v.citySum / v.count,
    base: v.baseSum / v.count,
  }));
}, [alignedCommonData, viewMode]);

/* =========================
     縣市KPI資料（四象限圖）
  ========================= */
const cityKPIData = useMemo(() => {
  const map = new Map<
    string,
    { totalPrac: number; totalStudents: number; totalScore: number; count: number }
  >();

  trend.forEach((row) => {
    const city = row.city;
    if (!map.has(city)) {
      map.set(city, {
        totalPrac: 0,
        totalStudents: 0,
        totalScore: 0,
        count: 0,
      });
    }

    const obj = map.get(city)!;
    obj.totalPrac += row.total_prac_count ?? 0;
    obj.totalScore += row.avg_score_rate ?? 0;
    obj.count += 1;
  });

  return Array.from(map.entries()).map(([city, v]) => ({
    city,
    avg_score: v.totalScore / v.count,
    avg_prac: v.totalPrac / (citySummary.find(c => c.city === city)?.total_students ?? 1),
  }));
}, [trend, citySummary]);

/* =========================
     本縣市 − 全部縣市平均（差距趨勢）
  ========================= */
const gapTrend = useMemo(() => {
  const baseMap = new Map(
    baselineTrend.map(t => [
      dayjs(t.activity_date).format("YYYY-MM-DD"),
      t.avg_score_rate,
    ])
  );

  return trend.map(t => {
    const date = dayjs(t.activity_date).format("YYYY-MM-DD");
    const base = baseMap.get(date) ?? 0;

    return {
      date,
      gap: t.avg_score_rate - base,
    };
  });
}, [trend, baselineTrend]);

/* =========================
     AI 助手功能
  ========================= */
  const runPolicyAIForChart = async (chart: PolicyExplainTarget) => {
  if (!kpiCurrent) return;

  const chartLabel = POLICY_EXPLAIN_MAP[chart];

  setGeminiLoading(true);

  const prompt = buildPolicyPracPrompt({
    city: selectedCity,
    subject: selectedSubject,
    period: periodLabel,
    startDate: startDate ?? null,
    endDate: endDate ?? null,

    selectedCharts: [chart],

    stats: {
      totalStudents: kpiCurrent.total_students,
      avgScore: kpiCurrent.avg_score_rate,
      avgPracPerStudent: kpiCurrent.avg_prac_per_student,
      schoolGap: kpiCurrent.school_score_std ?? null,
    },
  });

  window.dispatchEvent(
    new CustomEvent("policy-ai-update", {
      detail: {
        loading: true,
        questions: [chartLabel],
      },
    })
  );
  
  try {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        role: "policy",
      }),
    });

    const data = await res.json();

    window.dispatchEvent(
      new CustomEvent("policy-ai-update", {
        detail: {
          loading: false,
          content: data.text,
        },
      })
    );
  } catch (err) {
    console.error("Policy AI error:", err);

    window.dispatchEvent(
      new CustomEvent("policy-ai-update", {
        detail: {
          loading: false,
          content: "AI 分析失敗，請稍後再試。",
        },
      })
    );
  } finally {
    setGeminiLoading(false);
  }
};

const POLICY_EXPLAIN_MAP: Record<PolicyExplainTarget, string> = {
  overview: "總覽練習概況",
  development_index: "學力發展指標",
  regional_gap: "區域學習差距",
  gap_trend: "平均差距趨勢",
  practice_trend: "練習投入趨勢",
  effect_trend: "學習成效趨勢",
};





  /* =========================
     Render
  ========================= */
  return (
    <div className="min-h-screen p-0 space-y-4">
      {/* ===== 篩選器列 ===== */}
      <div className="flex flex-wrap items-center gap-4 p-3 ">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Filter className="w-4 h-4" />
        </div>

        {/* 縣市 */}
        <span className="text-sm">縣市：</span>
        <Select value={selectedCity} onValueChange={setSelectedCity}>
          <SelectTrigger className="w-[120px] bg-white border rounded">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cityList.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 科目 */}
        <span className="text-sm">科目：</span>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-[150px] bg-white border rounded">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {subjectList.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 日期區間 */}
        <div className="flex items-center gap-2 text-sm">
          <span>使用時數區間：</span>
          <input
            type="date"
            value={startDate ?? ""}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[140px] border rounded px-3 py-2 text-sm"
          />
          <span>～</span>
          <input
            type="date"
            value={endDate ?? ""}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[140px] border rounded px-3 py-2 text-sm"
          />
        </div>

        {/* AI 分析按鈕 */}
          <button
            onClick={() => runPolicyAIForChart("overview")}
            disabled={geminiLoading}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition shadow-sm
              ${
                geminiLoading
                  ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
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
                總覽練習表現
              </>
            )}
          </button>

        {/* 資料期間顯示 */}
        <div className="ml-auto text-xs text-slate-400 whitespace-nowrap">
          {periodLabel}
        </div>

        
      </div>

      

      {/* =========================
                KPI 區
      ========================= */}
      {kpiCompare && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* KPI 1: 學生母數 */}
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium">練習學生數</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-3xl font-bold text-green-900">
                {kpiCompare.current.total_students.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          {/* KPI 2: 平均答題正確率 */}
          {(() => {
            const cur = kpiCompare.current.avg_score_rate;
            const base = kpiCompare.baseline.avg_score_rate;
            const c = compareArrow(cur, base, 0.05);
            const badge = trafficLightForRate(cur, base);

            return (
              <Card className={`border ${badge}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-sm font-medium">平均答題正確率</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-bold text-green-900">
                      {cur.toFixed(1)}%
                    </div>
                    <div className={`text-2xl font-semibold ${c.cls}`}>
                      ({c.arrow})
                    </div>
                  </div>
                  <div className="text-xs mt-2 opacity-50">
                    全部縣市：{base.toFixed(1)}%（差 {c.diff >= 0 ? "+" : ""}
                    {c.diff.toFixed(1)}）
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* KPI 3: 人均練習次數 */}
          {(() => {
            const cur = kpiCompare.current.avg_prac_per_student;
            const base = kpiCompare.baseline.avg_prac_per_student;
            const c = compareArrow(cur, base, 0.01);
            const badge = trafficLightForPrac(cur, base);

            return (
              <Card className={`border ${badge}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-sm font-medium">人均練習次數</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-bold text-green-900">
                      {cur.toFixed(2)}
                    </div>
                    <div className={`text-2xl font-semibold ${c.cls}`}>
                      ({c.arrow})
                    </div>
                  </div>
                  <div className="text-xs mt-2 opacity-50">
                    全部縣市：{base.toFixed(2)}（差 {c.diff >= 0 ? "+" : ""}
                    {c.diff.toFixed(2)}）
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* KPI 4: 校際差距（反向：越小越好；↑↓代表相對 baseline 的變化，但顏色仍按“越小越好”） */}
          {(() => {
            const raw = kpiCurrent?.school_score_std;

            const value =
              typeof raw === "number" && Number.isFinite(raw)
                ? raw
                : null;

            if (value === null) {
              return (
                <Card className="border bg-slate-50">
                  <CardHeader className="pb-2 p-4">
                    <CardTitle className="text-sm font-medium">
                      平均校際差距
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-3xl font-bold text-slate-400">
                      —
                    </div>
                    <div className="text-xs mt-2 opacity-40">
                      無足夠資料
                    </div>
                  </CardContent>
                </Card>
              );
            }
            // ===== 政策燈號邏輯 =====
            let bgColor = "bg-emerald-50 border-emerald-200";
            let textColor = "text-green-900";
            let label = "表現均衡";

            if (value > 3) {
              bgColor = "bg-rose-50 border-rose-200";
              label = "差距偏大";
            } else if (value > 1.5) {
              bgColor = "bg-amber-50 border-amber-200";
              label = "中度差距";
            }

            return (
              <Card className={`border ${bgColor}`}>
                <CardHeader className="pb-2 p-4">
                  <CardTitle className="text-sm font-medium">
                    平均校際差距
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 pt-0">
                  <div className="flex items-end gap-2">

                    <div className={`text-3xl font-bold ${textColor}`}>
                      {value.toFixed(2)}
                    </div>

                    <div className="text-xs mt-2 opacity-60">
                      ({label})
                    </div>
                  </div>

                  
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}

      {/* =========================
              區塊一（3張圖表）
      ========================= */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ===== 圖表 1：政策訂位四象限圖 ===== */}
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
              學力發展指標
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
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f4fafb] shadow-xl border-slate-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-emerald-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li><b>人均練習：</b>該縣市總練習次數 ÷ 該縣市總學生數。</li>
                          <li><b>正確率：</b>該縣市學生所有練習題目的平均答對比例。</li>
                          <li><b>基準線：</b>虛線交點為全體縣市之平均值。</li>
                        </ul>
                        <p className="text-[12px] text-slate-400 pt-1 border-t">
                          ※ 透過此圖可識別各縣市在推動數位學習時的投入度與實質成效之關聯性。
                        </p>
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
              <button
                onClick={() => runPolicyAIForChart("development_index")}
                className="
                  flex items-center justify-center
                  w-8 h-8
                  rounded-full
                  text-emerald-500
                  hover:bg-emerald-50
                  transition
                "
              >
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>

              <Plot
                data={[
                  {
                    x: cityKPIData.map(d => d.avg_prac),
                    y: cityKPIData.map(d => d.avg_score),
                    text: cityKPIData.map(d => d.city),
                    mode: "markers+text",
                    type: "scatter",
                    textposition: "top center",
                    marker: {
                          size: 16,
                          color: "rgba(0, 0, 0, 0.47)",
                          line: {
                            color: "#f4f800ff",
                            width: 4,
                          },
                        },
                  },
                ]}
                layout={{
                  height: 260,
                  margin: { t: 20, r: 40, b: 50, l: 50 }, 
                  xaxis: {
                    title: "人均練習次數",
                    range: [0, Math.max(...cityKPIData.map(d => d.avg_prac)) * 1.2 || 5], 
                    fixedrange: true,
                  },
                  yaxis: {
                    title: "平均答題正確率 (%)",
                    range: [0, 105], 
                    fixedrange: true,
                  },
                  annotations: [
                    {
                      x: (kpiBaseline?.avg_prac_per_student || 0) * 1.4,
                      y: 95,
                      text: "<b>標竿區</b>",
                      showarrow: false,
                      font: { size: 12, color: "rgba(37, 99, 235, 0.6)" }, 
                      xref: "x", yref: "y",
                      layer: "below"
                    },
                    {
                      x: (kpiBaseline?.avg_prac_per_student || 0) * 0.3,
                      y: 95,
                      text: "<b>潛力區</b>",
                      showarrow: false,
                      font: { size: 12, color: "rgba(22, 163, 74, 0.6)" }, 
                      xref: "x", yref: "y",
                      layer: "below"
                    },
                    {
                      x: (kpiBaseline?.avg_prac_per_student || 0) * 0.3,
                      y: 10,
                      text: "<b>待觀察</b>",
                      showarrow: false,
                      font: { size: 12, color: "rgba(234, 88, 12, 0.6)" }, 
                      xref: "x", yref: "y",
                      layer: "below"
                    },
                    {
                      x: (kpiBaseline?.avg_prac_per_student || 0) * 1.4,
                      y: 10,
                      text: "<b>瓶頸區</b>",
                      showarrow: false,
                      font: { size: 12, color: "rgba(220, 38, 38, 0.6)" }, 
                      xref: "x", yref: "y",
                      layer: "below"
                    }
                  ],
                  // --- 十字基準線 ---
                  shapes: [
                    {
                      type: "line",
                      x0: kpiBaseline?.avg_prac_per_student ?? 0,
                      x1: kpiBaseline?.avg_prac_per_student ?? 0,
                      y0: 0,
                      y1: 100,
                      line: { dash: "dash", color: "gray", width: 1 },
                    },
                    {
                      type: "line",
                      y0: kpiBaseline?.avg_score_rate ?? 0,
                      y1: kpiBaseline?.avg_score_rate ?? 0,
                      x0: 0,
                      x1: Math.max(...cityKPIData.map(d => d.avg_prac)) * 1.2 || 5,
                      line: { dash: "dash", color: "gray", width: 1 },
                    },
                  ],
                }}
                style={{ width: "100%" }}
                config={{ displayModeBar: false, responsive: true }}
              />
        </Card>
        
        {/* ===== 圖表 2：區域學習成效排名 ===== */}
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
              區域學習差距
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
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f4fafb] shadow-xl border-slate-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-emerald-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li><b>綠色長條軸：</b>該縣市練習平均值。</li>
                          <li><b>灰色基準軸：</b>代表全部縣市之同期平均值。</li>
                          <li><b>正負差距 (±)：</b>綠色 (+) 表示領先、紅色 (-) 表示落後全部縣市平均的百分比幅度。</li>
                        </ul>
                        <p className="text-[12px] text-slate-400 pt-1 border-t">
                          ※ 透過此圖可衡量該區域的學力離差，觀察正負離差的極端值，數值越大代表區域間的學力鴻溝越明顯。
                        </p>
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
              <button
                onClick={() => runPolicyAIForChart("regional_gap")}
                className="
                  flex items-center justify-center
                  w-8 h-8
                  rounded-full
                  text-emerald-500
                  hover:bg-emerald-50
                  transition
                "
              >
                <Bot className="w-5 h-5" />
              </button>

            </div>
          </CardHeader>

          <Plot
            data={(() => {
              const baseline = kpiBaseline?.avg_score_rate ?? 0;

              const sorted = [...cityKPIData].sort(
                (a, b) => b.avg_score - a.avg_score
              );

              return [
                // Baseline
                {
                  x: sorted.map(() => baseline),
                  y: sorted.map(d => d.city),
                  type: "bar",
                  orientation: "h",
                  name: "全部縣市平均",
                  marker: {
                    color: "rgba(148,163,184,0.4)",
                  },
                  offsetgroup: "baseline",
                  hovertemplate:
                    "全部縣市平均：%{x:.1f}%<extra></extra>",
                },

                // City Avg
                {
                  x: sorted.map(d => d.avg_score),
                  y: sorted.map(d => d.city),
                  type: "bar",
                  orientation: "h",
                  name: `${selectedCity}平均`,
                  marker: {
                    color: "#16a34a",
                  },
                  offsetgroup: "city",
                  hovertemplate:
                    `${selectedCity}平均：%{x:.1f}%<extra></extra>`,
                },
              ];
            })()}
            layout={{
              height: 260,
              margin: { t: 20, r: 40, b: 20, l: 50 }, 
              barmode: "group",  
              xaxis: {
                title: "平均答題正確率 (%)",
                range: [0, 100],
              },
              yaxis: {
                automargin: true,
              },
              legend: {
                orientation: "h",
                y: -0.25,
              },

              // 差距線段
              shapes: (() => {
                const baseline = kpiBaseline?.avg_score_rate ?? 0;
                const sorted = [...cityKPIData].sort(
                  (a, b) => b.avg_score - a.avg_score
                );

                return sorted.map((d, i) => ({
                  type: "line",
                  x0: baseline,
                  x1: d.avg_score,
                  y0: i,
                  y1: i,
                  xref: "x",
                  yref: "y",
                  line: {
                    color: d.avg_score >= baseline
                      ? "#16a34a"
                      : "#ef4444",
                    width: 4,
                  },
                }));
              })(),

              // 差距標註
              annotations: (() => {
                const baseline = kpiBaseline?.avg_score_rate ?? 0;
                const sorted = [...cityKPIData].sort(
                  (a, b) => b.avg_score - a.avg_score
                );

                return sorted.map((d, i) => {
                  const diff = d.avg_score - baseline;

                  return {
                    x: d.avg_score,
                    y: d.city,
                    text: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`,
                    showarrow: false,
                    xanchor: diff >= 0 ? "left" : "right",
                    font: {
                      size: 16,
                      color: diff >= 0 ? "#16a34a" : "#ea1616ff",
                    },
                  };
                });
              })(),
            }}
            style={{ width: "100%" }}
            config={{ displayModeBar: false, responsive: true }}
          />
      </Card>

      {/* ===== 圖表 3：平均差距趨勢 ===== */}
      <Card className="col-span-1 relative">

        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <Activity className="animate-spin mr-2 w-4 h-4" />
            <span className="text-sm text-slate-600">資料分析中...</span>
          </div>
        )}

        <CardHeader className="flex flex-row items-start justify-between py-4 pb-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl font-bold text-slate-800">
              平均差距趨勢
            </CardTitle>
          </div>

          <div className="flex items-center gap-1 mt-1">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 transition">
                    <HelpCircle className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f4fafb] shadow-xl border-slate-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-emerald-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li><b>零位基準線 (0%)：</b>曲線位於此全部縣市基準線上方代表領先，下方代表落後。</li>
                          <li><b>填滿區塊：</b>呈現該時段累積領先/落後總量，區塊面積越大代表差距越顯著。</li>
                        </ul>
                        <p className="text-[12px] text-slate-400 pt-1 border-t">
                          ※ 透過此圖可觀察特定時間活動（如期中/期末考試期間），差距是否產生劇烈波動。
                        </p>
                      </div>
                    </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* AI 分析按鈕 */}
              <button
                onClick={() => runPolicyAIForChart("gap_trend")}
                className="
                  flex items-center justify-center
                  w-8 h-8
                  rounded-full
                  text-emerald-500
                  hover:bg-emerald-50
                  transition
                "
              >
                <Bot className="w-5 h-5" />
              </button>
          </div>
        </CardHeader>

        <div className="px-2">
          <Plot
            data={[
              {
                x: gapTrend.map(d => dayjs(d.date).format("YYYY-MM-DD")),
                y: gapTrend.map(d => d.gap),
                type: "scatter",
                mode: "lines+markers",
                name: "成效差距",
                line: { color: "#16a34a", width: 2, shape: 'spline' }, 
                fill: "tozeroy",
                fillcolor: "#16a34a30", 
                hovertemplate: "日期：%{x}<br>差距：%{y:+.1f}%<extra></extra>",
              },
            ]}
            layout={{
                height: 260,
                margin: { t: 0, r: 50, b: 90, l: 60 }, 
                xaxis: { 
                  title: "查詢期間",
                  tickangle: -45,
                  tickfont: { size: 10 },
                  type: 'category',
                  
                  range: [-0.5, gapTrend.length - 0.5],
                  automargin: true,
                },
                yaxis: {
                  title: "差距幅度 (%)",
                  zeroline: true,
                  zerolinecolor: "#040404", 
                  zerolinewidth: 3,
                  ticksuffix: "%",
                  
                  automargin: true, 
                },
                hovermode: "x unified", 
              }}
            style={{ width: "100%" }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      </Card>


    </div>

      {/* =========================
              區塊二（2張圖表）
      ========================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ===== 圖表 1：練習投入趨勢 ===== */}
        <Card className="col-span-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-6">
            {/* 左側：標題 */}
            <CardTitle className="text-xl font-bold ">
              練習投入趨勢
            </CardTitle>

            {/* 右側：按鈕群組 */}
            <div className="flex items-center gap-1">
              {/* 圖表說明 Tooltip */}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                    onClick={() => runPolicyAIForChart("practice_trend")}
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
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f4fafb] shadow-xl border-slate-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-emerald-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li>
                            <b className="text-emerald-600">活躍學生數 (長條圖)：</b>
                            指所選期間內，每日/週/月至少有一次登入或練習紀錄的去重複學生人數。
                          </li>
                          <li>
                            <b className="text-emerald-600">練習總次數 (折線圖)：</b>
                            學生完成練習題組的累計總數。
                          </li>
                        </ul>
                          <p className="text-[12px] text-slate-400 pt-1 border-t">
                            ※ 透過此圖可觀察使用參與度與學習投入強度之趨勢變動。
                          </p>
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
              <button
                onClick={() => runPolicyAIForChart("effect_trend")}
                className="
                  flex items-center justify-center
                  w-8 h-8
                  rounded-full
                  text-emerald-500
                  hover:bg-emerald-50
                  transition
                "
              >
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>


          {/* 日 / 週 / 月 切換按鈕 */}
            <div className="flex items-center gap-1 mr-2 px-8 ">
              {["day", "week", "month"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as any)}
                  className={`px-3 py-1 text-xs rounded-md transition
                    ${
                      viewMode === mode
                        ? "bg-emerald-600 text-white"
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
              // 長條圖：活躍學生數
              {
                x: aggregatedTrend.map((t) =>
                  dayjs(t.activity_date).format("YYYY-MM-DD")
                ),
                y: aggregatedTrend.map((t) => t.active_students),
                type: "bar",
                name: "活躍學生數",
                marker: {
                  color: "rgba(34,197,94,0.35)", 
                },
                hovertemplate:
                  "活躍學生數：%{y}<extra></extra>",
              },

              // 折線圖：練習總次數
              {
                x: aggregatedTrend.map((t) =>
                  dayjs(t.activity_date).format("YYYY-MM-DD")
                ),
                y: aggregatedTrend.map((t) => t.total_prac_count),
                type: "scatter",
                mode: "lines+markers",
                name: "練習總次數",
                line: {
                  color: "#16a34a", 
                  width: 3,
                },
                yaxis: "y2",
                hovertemplate:
                  "練習次數：%{y}<extra></extra>",
              },
            ]}
            layout={{
              height: 350,
              margin: { t: 20, l: 50, r: 50, b: 70 },
              barmode: "group",

              xaxis: {
                title: viewMode === "day" ? "日期" :
                      viewMode === "week" ? "週起始日" : "月份",
                type: "category",
                tickangle: -45,
                tickfont: { size: 10, color: "#64748b" },
              },

              // 左軸：學生數
              yaxis: {
                title: "活躍學生數",
                showgrid: true,
                zeroline: true,
              },

              // 右軸：練習次數
              yaxis2: {
                title: "練習總次數",
                overlaying: "y",
                side: "right",
                showgrid: false,
                zeroline: false,
              },

              legend: {
                orientation: "h",
                y: -0.25,
              },

              hovermode: "x unified",
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
          </CardContent>
        </Card>

        {/* ===== 圖表 2：成效趨勢 ===== */}
        <Card className="col-span-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-6">
            {/* 左側：標題 */}
            <CardTitle className="text-xl font-bold ">
              學習成效趨勢
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
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f4fafb] shadow-xl border-slate-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-emerald-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li>
                            <b className="text-emerald-700">{selectedCity}平均：</b>
                            顯示 {selectedCity} 的平均正確率趨勢，代表該區學生的實質掌握度。
                          </li>
                          <li>
                            <b className="text-red-600">全部縣市平均：</b>
                            作為基準線以判斷該區表現優於或低於全國平均。
                          </li>
                        </ul>
                          <p className="text-[12px] text-slate-400 pt-1 border-t">
                            ※ 透過此圖可觀察{selectedCity}平均答題正確率與全部縣市平均之波動穩定度。
                          </p>                       
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
              <button
                className="
                  flex items-center justify-center
                  w-8 h-8
                  rounded-full
                  text-emerald-500
                  hover:bg-emerald-50
                  transition
                "
              >
                <Bot className="w-5 h-5" />
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
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
              >
                {mode === "day" ? "日線" : mode === "week" ? "週線" : "月線"}
              </button>
            ))}
          </div>

          <Plot
            data={[
              {
                x: aggregatedScoreTrend.map((d) => d.date),
                y: aggregatedScoreTrend.map((d) => d.city),
                type: "scatter",
                mode: "lines+markers",
                name:
                  selectedCity === "全部縣市"
                    ? "全部縣市平均"
                    : `${selectedCity}平均`,
                line: { color: "#16a34a", width: 3 },
                hovertemplate:
                  "平均正確率：%{y:.1f}%<extra></extra>",
              },
              {
                x: aggregatedScoreTrend.map((d) => d.date),
                y: aggregatedScoreTrend.map((d) => d.base),
                type: "scatter",
                mode: "lines+markers",
                name: "全部縣市平均",
                line: {
                  color: "#f05555ff",
                  width: 2,
                  dash: "dash",
                },
                hovertemplate:
                  "全部縣市平均：%{y:.1f}%<extra></extra>",
              },
            ]}
            layout={{
              height: 350,
              margin: { t: 20, l: 50, r: 20, b: 40 },

              xaxis: {
                title: "日期",
                type: "category",
                tickangle: -45,
                tickfont: {
                  size: 10,
                  color: "#64748b",
                },
              },

              yaxis: {
                title: "平均答題正確率 (%)",
                range: [0, 105],
                ticksuffix: "%",
              },

              legend: {
                orientation: "h",
                y: -0.25,
              },

              hovermode: "x unified",
            }}
            style={{ width: "100%" }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </Card>
      </div>

      

    </div>
  );
}