import { useEffect, useMemo, useState, useRef } from "react"; 
import { useOutletContext } from "react-router-dom";
import Plot from "react-plotly.js";
import { supabase } from "@/lib/supabase";
import dayjs from "dayjs";
import _ from 'lodash';
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

interface CityContext {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
}

type SchoolRow = {
  organization_id: string;
  city: string;
  total_students: number;
  total_prac_count: number;
  avg_score_rate: number;
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
  | "policy_overview"
  | "development_index"
  | "regional_gap"
  | "gap_trend"
  | "practice_trend"
  | "effect_trend"
  | "scissors_gap"      
  | "school_matrix";    


export default function PolicyPrac() {
  /* =========================
     常數：顯示字串
  ========================= */
  const ALL_CITY = "全部縣市";
  const ALL_SUBJECT = "全部科目";

  /* =========================
     篩選狀態
  ========================= */
  const { selectedCity, setSelectedCity } = useOutletContext<CityContext>();
  const [selectedSubject, setSelectedSubject] = useState<string>(ALL_SUBJECT);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const scissorsGapRef = useRef<HTMLDivElement>(null);
  
 

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
  const [allCitiesTrend, setAllCitiesTrend] = useState<CityTrendRow[]>([]); 
  const [baselineTrend, setBaselineTrend] = useState<CityTrendRow[]>([]); 
  const [schoolData, setSchoolData] = useState<SchoolRow[]>([]); 
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
     查詢：目前條件 + baseline + 全縣市 + 學校層級
  ========================= */
  useEffect(() => {
    const loadTrend = async () => {
      if (!startDate || !endDate) return;

      setLoading(true);

      try {
        const isAllSubject = selectedSubject === ALL_SUBJECT;
        const currentTable = isAllSubject ? "city_trend_daily" : "city_subject_trend_daily";
        const baselineTable = isAllSubject ? "city_trend_daily" : "subject_trend_daily";

        // =============================
        // 1. 查詢目前條件資料 (受縣市過濾影響，供 KPI 與趨勢圖使用)
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

        const { data: currentData } = await q.order("activity_date", { ascending: true });
        setTrend(currentData ?? []);

        // =============================
        // 查詢「全縣市」資料 (不受縣市過濾影響，供四象限圖與差距排名圖使用)
        // =============================
        let allCitiesQ = supabase
          .from(currentTable)
          .select("*")
          .gte("activity_date", startDate)
          .lte("activity_date", endDate);

        if (!isAllSubject) {
          allCitiesQ = allCitiesQ.eq("subject_name", selectedSubject);
        }
        
        const { data: allCitiesData } = await allCitiesQ.order("activity_date", { ascending: true });
        setAllCitiesTrend(allCitiesData ?? []);


        // =============================
        // 3. baseline 永遠是全部縣市 (不分縣市維度)
        // =============================
        let baseQuery = supabase
          .from(baselineTable)
          .select("*")
          .gte("activity_date", startDate)
          .lte("activity_date", endDate);

        if (!isAllSubject) {
          baseQuery = baseQuery.eq("subject_name", selectedSubject);
        }

        const { data: baseData } = await baseQuery.order("activity_date", { ascending: true });
        setBaselineTrend(baseData ?? []);


        // =============================
        // 4. 查詢學校層級資料
        // =============================
        let schoolQ = supabase
          .from("school_summary")
          .select("organization_id, city, total_students, total_prac_count, avg_score_rate");
        
        if (selectedCity !== ALL_CITY) {
          schoolQ = schoolQ.eq("city", selectedCity);
        }
        
        const { data: sData } = await schoolQ;
        setSchoolData(sData ?? []);

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

  const cityRows = selectedCity === ALL_CITY 
    ? trend 
    : trend.filter((r) => r.city === selectedCity);

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

  let schoolStd: number = NaN; 

  if (selectedSubject === ALL_SUBJECT) {
    const validRows = cityRows.filter(
      (r) => r.school_score_std != null && (r.total_prac_count || 0) > 0
    );

    if (validRows.length > 1) {
      const totalWeight = _.sumBy(validRows, "total_prac_count");
      const weightedSum = validRows.reduce(
        (acc, r) => acc + (r.school_score_std * r.total_prac_count), 0
      );
      const weightedMean = weightedSum / totalWeight;

      const weightedVarianceNumerator = validRows.reduce((acc, r) => {
        const diff = r.school_score_std - weightedMean;
        return acc + (r.total_prac_count * (diff * diff));
      }, 0);

      schoolStd = Math.sqrt(weightedVarianceNumerator / totalWeight);
    } else {
      schoolStd = NaN;
    }
  } 
  else {
    const row = citySubjectSummary.find(
      (r) => r.city === selectedCity && r.subject_name === selectedSubject
    );
    schoolStd = row?.school_score_std ?? NaN;
  }

  return {
    total_students: totalStudentsBySelection,
    avg_score_rate: avgScore, 
    avg_prac_per_student: avgPracPerStudent, 
    school_score_std: schoolStd, 
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

  const compareArrow = (current: number, baseline: number, eps = 1e-9) => {
    const diff = current - baseline;
    if (Math.abs(diff) <= eps) return { arrow: "→", diff, cls: "text-slate-500" };
    if (diff > 0) return { arrow: "↑", diff, cls: "text-emerald-600" };
    return { arrow: "↓", diff, cls: "text-rose-600" };
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
     只顯示共同有日期資料 (並將 std 提取出來，供剪刀差圖表使用)
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
      { score: t.avg_score_rate, std: t.school_score_std },
    ])
  );

  const baseMap = new Map(
    baselineTrend.map((t) => [
      dayjs(t.activity_date).format("YYYY-MM-DD"),
      { score: t.avg_score_rate, std: t.school_score_std },
    ])
  );

  return commonDates.map((date) => ({
    date,
    city: cityMap.get(date)?.score ?? null,
    cityStd: cityMap.get(date)?.std ?? null,
    base: baseMap.get(date)?.score ?? null,
    baseStd: baseMap.get(date)?.std ?? null,
  }));
}, [commonDates, trend, baselineTrend]);

/* =========================
     日 / 週 / 月聚合資料
  ========================= */
/* =========================
     日 / 週 / 月聚合資料
  ========================= */
const aggregatedScoreTrend = useMemo(() => {
  if (viewMode === "day") return alignedCommonData;

  const map = new Map<
    string,
    { 
      citySum: number; 
      baseSum: number; 
      cityStdSum: number; 
      stdCount: number; 
      baseStdSum: number;   
      baseStdCount: number; 
      count: number; 
    }
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
        cityStdSum: 0,
        stdCount: 0,
        baseStdSum: 0,     
        baseStdCount: 0,  
        count: 0,
      });
    }

    const obj = map.get(key)!;
    obj.citySum += d.city ?? 0;
    obj.baseSum += d.base ?? 0;
    obj.count += 1;
    
    // 累加本區標準差
    if (d.cityStd != null) {
      obj.cityStdSum += d.cityStd;
      obj.stdCount += 1;
    }

    if (d.baseStd != null) {
      obj.baseStdSum += d.baseStd;
      obj.baseStdCount += 1;
    }
  });

  return Array.from(map.entries()).map(([date, v]) => ({
    date,
    city: v.citySum / v.count,
    base: v.baseSum / v.count,
    cityStd: v.stdCount > 0 ? v.cityStdSum / v.stdCount : null,
    baseStd: v.baseStdCount > 0 ? v.baseStdSum / v.baseStdCount : null, // 計算出平均並放進物件中
  })).sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
}, [alignedCommonData, viewMode]);

/* =========================
     縣市KPI資料（改使用 allCitiesTrend 計算，供跨縣市比較圖表使用）
  ========================= */
const cityKPIData = useMemo(() => {
  const map = new Map<
    string,
    { totalPrac: number; totalStudents: number; totalScore: number; count: number }
  >();

  //  allCitiesTrend這樣即使選了單一縣市，也能保留其他縣市用來畫灰色背景列
  allCitiesTrend.forEach((row) => {
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
}, [allCitiesTrend, citySummary]);

/* =========================
     學校層次散佈圖
  ========================= */
const schoolMatrixData = useMemo(() => {
  if (!schoolData || schoolData.length === 0) return [];
  
  const validData = schoolData.filter(s => s.total_students > 0);
  const groupedSchools = _.groupBy(validData, 'organization_id');

  const mergedData = Object.entries(groupedSchools).map(([org_id, group]) => {
    const rows = group as SchoolRow[]; 
    const city = rows[0].city;
    const students = Math.max(...rows.map(r => r.total_students));
    const totalPrac = rows.reduce((sum, r) => sum + (r.total_prac_count || 0), 0);
    const avgScore = rows.reduce((sum, r) => sum + (r.avg_score_rate || 0), 0) / rows.length;

    return {
      organization_id: org_id,
      city: city,
      avg_prac: totalPrac / students, 
      avg_score: avgScore,            
      size: Math.sqrt(students) * 3.5 
    };
  });

  return mergedData;
}, [schoolData]);

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

  const safeSchoolGap = Number.isNaN(kpiCurrent.school_score_std) 
      ? null 
      : kpiCurrent.school_score_std;

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
    if (!res.ok) {
        throw new Error(`API Error: ${res.status} - ${res.statusText}`);
      }

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
  policy_overview: "總覽練習概況",
  development_index: "練習診斷指標",
  regional_gap: "區域學習差距",
  gap_trend: "區域成效對標",
  practice_trend: "練習時間走勢",
  effect_trend: "學習成效走勢",
  scissors_gap: "校際差距走勢",
  school_matrix: "學校落點"
};

/* =========================
   監聽多圖整合分析
========================= */
useEffect(() => {
  const handler = async (e: Event) => {
    const detail = (e as CustomEvent<{ charts: string[] }>).detail;
    if (!detail || !detail.charts?.length) return;
    if (!kpiCurrent) return;

    const selected: PolicyExplainTarget[] = detail.charts.filter(
      (c): c is PolicyExplainTarget =>
        c in POLICY_EXPLAIN_MAP
    );

    if (!selected.length) return;

    setGeminiLoading(true);

    const chartLabels = selected.map(
      (c) => POLICY_EXPLAIN_MAP[c]
    );

    const safeSchoolGap = Number.isNaN(kpiCurrent.school_score_std) 
      ? null 
      : kpiCurrent.school_score_std;

    const prompt = buildPolicyPracPrompt({
      city: selectedCity,
      subject: selectedSubject,
      period: periodLabel,
      startDate: startDate ?? null,
      endDate: endDate ?? null,

      selectedCharts: selected, 

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
          role: "policy",
        }),
      });

      if (!res.ok) {
        throw new Error(`API Error: ${res.status} - ${res.statusText}`);
      }

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
      console.error("Policy Multi AI error:", err);

      window.dispatchEvent(
        new CustomEvent("policy-ai-update", {
          detail: {
            loading: false,
            content: "AI 整合分析失敗，請稍後再試。",
          },
        })
      );
    } finally {
      setGeminiLoading(false);
    }
  };

  window.addEventListener("policy-ai-multi-request", handler);

  return () => {
    window.removeEventListener("policy-ai-multi-request", handler);
  };
}, [
  selectedCity,
  selectedSubject,
  startDate,
  endDate,
  periodLabel,
  kpiCurrent,
]);


  /* =========================
     Render
  ========================= */
  return (
    <div className="min-h-screen p-4 space-y-6">
      {/* ===== 篩選器列 ===== */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 p-2 pb-1">
          <div className="p-1 text-slate-400">
            <Filter className="w-5 h-5"/>
          </div>

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
          <span>時間區間：</span>
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
            onClick={() => runPolicyAIForChart("policy_overview")}
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
          </div>

        </div>

       {/* 資料期間顯示 */}
        <div className="flex justify-end px-4 -mt-1">
          <span className="text-xs text-slate-400">
            {periodLabel}
          </span>
        </div>

        
    

      {/* =========================
        KPI 區 
    ========================= */}
      {kpiCompare && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* KPI 1: 學生母數 */}
          <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
            <div className="bg-slate-500 text-white text-base font-bold py-2.5 px-3 text-center border-b border-slate-200">
              練習總學生數
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <div className="text-3xl font-black text-slate-800 tracking-tight">
                {kpiCompare.current.total_students.toLocaleString()}
              </div>
            </div>
          </div>

          {/* KPI 2: 平均答題正確率 */}
          {(() => {
            const cur = kpiCompare.current.avg_score_rate;
            const base = kpiCompare.baseline.avg_score_rate;
            const c = compareArrow(cur, base, 0.05);

            return (
              <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
                <div className="bg-slate-500 text-white text-base font-bold py-2.5 px-3 text-center border-b border-slate-200">
                  平均答題正確率
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                  <div className="flex items-end gap-2 text-center">
                          <div className="text-3xl font-black text-slate-800 tracking-tight">
                            {cur.toFixed(1)}
                          </div>
                          <div className={`text-2xl font-bold  ${c.cls}`}>
                            ({c.arrow})
                          </div>
                        </div>
                        <div className="text-xs mt-1 text-center opacity-50">
                          全部縣市 {base.toFixed(1)}% <br/>
                          ( {c.diff >= 0 ? "↑" : "↓"} {c.diff.toFixed(1)} % ）
                        </div>
                </div>
              </div>
            );
          })()}

          {/* KPI 3: 人均練習次數 */}
          {(() => {
            const cur = kpiCompare.current.avg_prac_per_student;
            const base = kpiCompare.baseline.avg_prac_per_student;
            const c = compareArrow(cur, base, 0.01);

            return (
              <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
                <div className="bg-slate-500 text-white text-base font-bold py-2.5 px-3 text-center border-b border-slate-200">
                  人均練習次數
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                  <div className="flex items-end gap-2">
                          <div className="text-3xl font-black text-slate-800 tracking-tight">
                            {cur.toFixed(1)}
                          </div>
                          <div className={`text-2xl font-bold ${c.cls}`}>
                            ({c.arrow})
                          </div>
                        </div>
                        <div className="text-xs mt-1 text-center opacity-50">
                          全部縣市 {base.toFixed(1)} 次<br/>
                          （ {c.diff >= 0 ? "↑" : "↓"} {c.diff.toFixed(1)} 次 ）
                        </div>
                </div>
              </div>
            );
          })()}

          {/* KPI 4: 平均校際差距 */}
            {(() => {
              const value = kpiCurrent?.school_score_std;
              const isNaNValue = isNaN(value);
              
              
              let config = {
                bg: "bg-slate-500",      // 標題背景
                hoverBg: "group-hover:bg-slate-600",
                text: "text-slate-500",  // 數值文字
                border: "border-slate-200",
                label: "數據計算中",
                highlight: "hover:border-slate-400"
              };

              if (!isNaNValue) {
                if (value > 3) {
                  config = {
                    bg: "bg-rose-500",
                    hoverBg: "group-hover:bg-rose-600",
                    text: "text-rose-600",
                    border: "border-rose-100",
                    label: "顯著失衡",
                    highlight: "hover:border-rose-500"
                  };
                } else if (value > 1.5) {
                  config = {
                    bg: "bg-amber-500",
                    hoverBg: "group-hover:bg-amber-600",
                    text: "text-amber-600",
                    border: "border-amber-100",
                    label: "輕微差距",
                    highlight: "hover:border-amber-500"
                  };
                } else {
                  config = {
                    bg: "bg-emerald-500",
                    hoverBg: "group-hover:bg-emerald-600",
                    text: "text-emerald-600",
                    border: "border-emerald-100",
                    label: "區域均衡",
                    highlight: "hover:border-emerald-500"
                  };
                }
              }

              return (
                <div 
                  className={`flex flex-col border ${config.border} rounded-lg overflow-hidden shadow-sm bg-white cursor-pointer ${config.highlight} transition-all duration-300 relative group`}
                  onClick={() => scissorsGapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                >
                  {/* 動態標題背景 */}
                  <div className={`${config.bg} ${config.hoverBg} transition-colors text-white text-base font-bold py-2.5 px-3 text-center`}>
                    平均校際差距
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center p-5">
                    {isNaNValue ? (
                      <>
                        <div className="text-3xl font-black tracking-tight text-slate-300">NaN</div>
                        <div className="text-[12px] text-slate-400 mt-1 text-center">目前為該行政區唯一數據</div>
                      </>
                    ) : (
                      <>
                        <div className={`text-4xl font-black tracking-tight ${config.text}`}>
                          {value.toFixed(2)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[13px] font-medium text-slate-500">{config.label}</span>
                        </div>
                        
                        {/* 提示文字優化 */}
                        <div className={`text-[11px] ${config.text} opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all`}>
                          查看詳細走勢圖表 ↓
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {/* =========================
              區塊一（3張圖表）
      ========================= */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ===== 圖表 1：政策訂位四象限圖 ===== */}
        <Card className="col-span-1 relative">

          {loading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Activity className="animate-spin mr-2 w-4 h-4" />
                <span className="text-sm text-slate-600">資料分析中...</span>
              </div>
            )}
          
          
          <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
            <CardTitle className="text-xl font-bold ">
              練習診斷指標
               <span className="px-2 text-[9px] text-green-600">（ 科目：{selectedSubject} ）</span>
            </CardTitle>

            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
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

              <button
                onClick={() => runPolicyAIForChart("development_index")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-emerald-500 hover:bg-emerald-50 transition"
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
                    
                    hovertemplate: 
                      "<b>%{text}</b><br>" + 
                      "人均練習次數: %{x:.1f} 次<br>" + 
                      "平均答題正確率: %{y:.1f}%<br>" +
                      "<extra></extra>",
                    
                    marker: {
                          size: 16,                          
                          color: cityKPIData.map(d => 
                            selectedCity === "全部縣市" || d.city === selectedCity 
                              ? "rgba(0, 0, 0, 0.6)" 
                              : "rgba(0, 0, 0, 0.1)"
                          ),
                          line: {
                            color: cityKPIData.map(d => 
                              selectedCity === "全部縣市" || d.city === selectedCity 
                                ? "#f4f800ff" 
                                : "transparent"
                            ),
                            width: 4,
                          },
                    },
                    
                    textfont: {
                      color: cityKPIData.map(d => 
                        selectedCity === "全部縣市" || d.city === selectedCity 
                          ? "#334155" 
                          : "rgba(100, 116, 139, 0.2)"
                      ),
                    },
                  },
                ]}
                layout={{
                  height: 260,
                  margin: { t: 20, r: 50, b: 20, l: 70 }, 
                  xaxis: {                    
                    title: { text: "人均練習次數", font: { size: 10, color: '#64748b' }, standoff: 15 },
                    range: [0, Math.max(...cityKPIData.map(d => d.avg_prac)) * 1.2 || 5], 
                    fixedrange: true,
                  },
                  yaxis: {
                    title: { text: `${selectedCity}平均答題正確率 (%)`, font: { size: 10, color: '#64748b' }, standoff: 15 },
                    range: [0, 105], 
                    fixedrange: true,
                  },
                  annotations: [
                    {
                      x: (kpiBaseline?.avg_prac_per_student || 0) * 1.4, y: 95,
                      text: "<b>標竿區</b>", showarrow: false,
                      font: { size: 12, color: "rgba(37, 99, 235, 0.6)" }, 
                      xref: "x", yref: "y", layer: "below"
                    },
                    {
                      x: (kpiBaseline?.avg_prac_per_student || 0) * 0.3, y: 95,
                      text: "<b>潛力區</b>", showarrow: false,
                      font: { size: 12, color: "rgba(22, 163, 74, 0.6)" }, 
                      xref: "x", yref: "y", layer: "below"
                    },
                    {
                      x: (kpiBaseline?.avg_prac_per_student || 0) * 0.3, y: 10,
                      text: "<b>待觀察</b>", showarrow: false,
                      font: { size: 12, color: "rgba(234, 88, 12, 0.6)" }, 
                      xref: "x", yref: "y", layer: "below"
                    },
                    {
                      x: (kpiBaseline?.avg_prac_per_student || 0) * 1.4, y: 10,
                      text: "<b>瓶頸區</b>", showarrow: false,
                      font: { size: 12, color: "rgba(220, 38, 38, 0.6)" }, 
                      xref: "x", yref: "y", layer: "below"
                    }
                  ],
                  shapes: [
                    {
                      type: "line",
                      x0: kpiBaseline?.avg_prac_per_student ?? 0, x1: kpiBaseline?.avg_prac_per_student ?? 0,
                      y0: 0, y1: 100,
                      line: { dash: "dash", color: "gray", width: 1 },
                    },
                    {
                      type: "line",
                      y0: kpiBaseline?.avg_score_rate ?? 0, y1: kpiBaseline?.avg_score_rate ?? 0,
                      x0: 0, x1: Math.max(...cityKPIData.map(d => d.avg_prac)) * 1.2 || 5,
                      line: { dash: "dash", color: "gray", width: 1 },
                    },
                  ],
                }}
                style={{ width: "100%" }}
                config={{ displayModeBar: false, responsive: true }}
              />
        </Card>

        {/* ===== 學校落點散佈圖 ===== */}
        <Card className="col-span-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
            <CardTitle className="text-xl font-bold ">
              學校落點
               <span className="px-2 text-[9px] text-green-600">（ 科目：{selectedSubject} ）</span>
            </CardTitle>

            <div className="flex items-center gap-1">              
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f4fafb] shadow-xl border-slate-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-emerald-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li><b>每個氣泡：</b>代表該縣市內的一所學校，氣泡大小對應學校規模(學生數)。</li>
                          <li><b>十字基準線：</b>交會點為該區的「平均練習量」與「平均正確率」。</li>
                        </ul>
                        <p className="text-[12px] text-slate-400 pt-1 border-t">
                         - 落在<b>「高投入低成效(右下)」</b>：需提供師資培訓與教學法支援。<br/>
                          - 落在<b>「低投入低成效(左下)」</b>：需行政力介入與硬體設備盤點。
                        </p>
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <button
                onClick={() => runPolicyAIForChart("school_matrix")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-emerald-500 hover:bg-emerald-50 transition"
              >
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>

          <CardContent className="h-[300px] w-full pt-6">
            {schoolMatrixData.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-slate-400">
              </div>
            ) : (
              <Plot
                data={[
                  {
                    x: schoolMatrixData.map(d => d.avg_prac),
                    y: schoolMatrixData.map(d => d.avg_score),
                    text: schoolMatrixData.map(d => d.organization_id),
                    mode: "markers+text",
                    type: "scatter",
                    textposition: "top center", 
                    textfont: { size: 9, color: "#027d2fff" },
                    marker: {
                      size: schoolMatrixData.map(d => d.size),
                      color: "rgba(22, 163, 74, 0.6)", 
                      line: { color: "#16a34a", width: 1 },
                    },
                    hovertemplate: 
                      "<b>學校代碼：%{text}</b><br>" +
                      "人均練習：%{x:.1f} 次<br>" + 
                      "平均正確率：%{y:.1f}%<br>" +
                      "<extra></extra>",
                  },
                ]}
                layout={{
                  height: 260, 
                  margin: { t: 0, r: 40, b: 50, l: 70 }, 
                  xaxis: {                    
                    title: { text: "學校人均練習次數", font: { size: 10, color: '#64748b' }, standoff: 15 },
                    rangemode: 'tozero',
                  },
                  yaxis: {
                    title: { text: "學校平均正確率 (%)", font: { size: 10, color: '#64748b' }, standoff: 15 },
                    range: [0, 105], 
                  },
                  shapes: [
                    {
                      type: "line", x0: kpiCurrent?.avg_prac_per_student ?? 0, x1: kpiCurrent?.avg_prac_per_student ?? 0,
                      y0: 0, y1: 100, line: { dash: "dash", color: "rgba(0,0,0,0.3)", width: 1.5 },
                    },
                    {
                      type: "line", y0: kpiCurrent?.avg_score_rate ?? 0, y1: kpiCurrent?.avg_score_rate ?? 0,
                      x0: 0, x1: Math.max(...schoolMatrixData.map(d => d.avg_prac)) * 1.2 || 10,
                      line: { dash: "dash", color: "rgba(0,0,0,0.3)", width: 1.5 },
                    },
                  ],
                  annotations: [
                    { x: 0.05, y: 0.95, xref: "paper", yref: "paper", text: "<b>低投入高成效</b>", showarrow: false, font: { size: 12, color: "rgba(100, 116, 139, 0.4)" } },
                    { x: 0.95, y: 0.95, xref: "paper", yref: "paper", text: "<b>高投入高成效</b>", showarrow: false, font: { size: 12, color: "rgba(100, 116, 139, 0.4)" } },
                    { x: 0.05, y: 0.05, xref: "paper", yref: "paper", text: "<b>低投入低成效</b>", showarrow: false, font: { size: 12, color: "rgba(100, 116, 139, 0.4)" } },
                    { x: 0.95, y: 0.05, xref: "paper", yref: "paper", text: "<b>高投入低成效</b>", showarrow: false, font: { size: 12, color: "rgba(100, 116, 139, 0.4)" } }
                  ],
                }}
                style={{ width: "100%" }}
                config={{ displayModeBar: false, responsive: true }}
              />
            )}
          </CardContent>
        </Card>
        
        {/* ===== 區域學習差距 ===== */}
        <Card className="col-span-1 relative">

          {loading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Activity className="animate-spin mr-2 w-4 h-4" />
                <span className="text-sm text-slate-600">資料分析中...</span>
              </div>
            )}
          
          <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
            <CardTitle className="text-xl font-bold ">
              區域學習差距
              <span className="px-2 text-[9px] text-green-600">（ 科目：{selectedSubject} ）</span>
            </CardTitle>

            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f4fafb] shadow-xl border-slate-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-emerald-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li><b>長條軸：</b>該縣市練習平均值。</li>
                          <li><b>灰色基準軸：</b>代表全部縣市之同期平均值。</li>
                          <li><b>正負差距 (±)：</b>綠色 (+) 表示領先、紅色 (-) 表示落後全部縣市平均的幅度。</li>
                        </ul>
                        <p className="text-[12px] text-slate-400 pt-1 border-t">
                          ※ 透過此圖可衡量該區域的學力離差，觀察正負離差的極端值，數值越大代表區域間的學力鴻溝越明顯。
                        </p>
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <button
                onClick={() => runPolicyAIForChart("regional_gap")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-emerald-500 hover:bg-emerald-50 transition"
              >
                <Bot className="w-5 h-5" />
              </button>

            </div>
          </CardHeader>

          <Plot
            data={(() => {
              const baseline = kpiBaseline?.avg_score_rate ?? 0;
              const sorted = [...cityKPIData].sort((a, b) => b.avg_score - a.avg_score);

              return [
                {
                  x: sorted.map(() => baseline),
                  y: sorted.map(d => d.city),
                  type: "bar", orientation: "h",
                  name: "全部縣市平均",
                  marker: { color: "rgba(148,163,184,0.3)" },
                  offsetgroup: "baseline",
                  hovertemplate: "全部縣市平均：%{x:.1f}%<extra></extra>",
                },
                {
                  x: sorted.map(d => d.avg_score),
                  y: sorted.map(d => d.city),
                  type: "bar", orientation: "h",
                  name: "各縣市平均",
                  // 區域差距圖：根據所選縣市變色高亮
                  marker: { 
                    color: sorted.map(d => 
                      selectedCity === "全部縣市" || d.city === selectedCity
                        ? "#16a34a" 
                        : "rgba(22, 163, 74, 0.15)"
                    )
                  },
                  offsetgroup: "city",
                  hovertemplate: "%{y}平均：%{x:.1f}%<extra></extra>",
                },
              ];
            })()}
            layout={{
              height: 260, margin: { t: 20, r: 40, b: 20, l: 50 }, barmode: "group",  
              xaxis: { title: "平均答題正確率 (%)", range: [0, 100] },
              yaxis: { 
                automargin: true,
                tickfont: {
                  color: (() => {
                     const sorted = [...cityKPIData].sort((a, b) => b.avg_score - a.avg_score);
                     return sorted.map(d => 
                       selectedCity === "全部縣市" || d.city === selectedCity ? "#334155" : "#cbd5e1"
                     );
                  })()
                }
              },
              legend: { orientation: "h", y: -0.25 },

              shapes: (() => {
                const baseline = kpiBaseline?.avg_score_rate ?? 0;
                const sorted = [...cityKPIData].sort((a, b) => b.avg_score - a.avg_score);
                return sorted.map((d, i) => {
                  const isSelected = selectedCity === "全部縣市" || d.city === selectedCity;
                  const isPositive = d.avg_score >= baseline;
                  return {
                    type: "line", x0: baseline, x1: d.avg_score, y0: i, y1: i, xref: "x", yref: "y",
                    line: { 
                      color: isPositive ? (isSelected ? "#16a34a" : "rgba(22, 163, 74, 0.2)") : (isSelected ? "#ef4444" : "rgba(239, 68, 68, 0.2)"), 
                      width: isSelected ? 4 : 2 
                    },
                  };
                });
              })(),

              annotations: (() => {
                const baseline = kpiBaseline?.avg_score_rate ?? 0;
                const sorted = [...cityKPIData].sort((a, b) => b.avg_score - a.avg_score);
                return sorted.map((d, i) => {
                  const diff = d.avg_score - baseline;
                  const isSelected = selectedCity === "全部縣市" || d.city === selectedCity;
                  const isPositive = diff >= 0;
                  return {
                    x: d.avg_score, y: d.city, text: `${isPositive ? "+" : ""}${diff.toFixed(1)}%`,
                    showarrow: false, xanchor: isPositive ? "left" : "right",
                    font: { 
                      size: isSelected ? 16 : 11, 
                      color: isPositive ? (isSelected ? "#16a34a" : "rgba(22, 163, 74, 0.4)") : (isSelected ? "#ea1616ff" : "rgba(234, 22, 22, 0.4)") 
                    },
                  };
                });
              })(),
            }}
            style={{ width: "100%" }}
            config={{ displayModeBar: false, responsive: true }}
          />
      </Card>

      {/* ===== 區域成效對標===== */}
      <Card className="col-span-1 relative">

        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <Activity className="animate-spin mr-2 w-4 h-4" />
            <span className="text-sm text-slate-600">資料分析中...</span>
          </div>
        )}

        <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
            <CardTitle className="text-xl font-bold ">
              區域成效對標
              <span className="px-2 text-[9px] text-green-600">（ 科目：{selectedSubject} ）</span>
            </CardTitle>
         
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

              <button
                onClick={() => runPolicyAIForChart("gap_trend")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-emerald-500 hover:bg-emerald-50 transition"
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
                type: "scatter", mode: "lines+markers",
                name: "成效差距",
                line: { color: "#16a34a", width: 2, shape: 'spline' }, 
                fill: "tozeroy", fillcolor: "#16a34a30", 
                hovertemplate: "日期：%{x}<br>差距：%{y:+.1f}%<extra></extra>",
              },
            ]}
            layout={{
                height: 260, margin: { t: 10, r: 40, b: 100, l: 90 }, 
                xaxis: { 
                  title: { text: "練習期間", font: { size: 10, color: '#64748b' }, standoff: 15 },
                  tickangle: -45, tickfont: { size: 10 },
                  type: 'category', range: [-0.5, gapTrend.length - 0.5], automargin: true,
                },
                yaxis: {
                  title: { text: "差距幅度 (%)", font: { size: 10, color: '#64748b' }, standoff: 15 },
                  zeroline: true, zerolinecolor: "#040404", zerolinewidth: 3, ticksuffix: "%", automargin: true, 
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

        {/* ===== 圖表 4：練習時間走勢 ===== */}
        <Card className="col-span-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-6">
            <CardTitle className="text-xl font-bold ">
              練習時間走勢
              <span className="px-2 text-xs text-green-600">（ 科目：{selectedSubject} ）</span>
            </CardTitle>

            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f4fafb] shadow-xl border-emerald-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-emerald-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li><b className="text-emerald-600">活躍學生數 (長條圖)：</b>指所選期間內，去重複學生人數。</li>
                          <li><b className="text-emerald-600">練習總次數 (折線圖)：</b>學生完成練習題組的累計總數。</li>
                        </ul>
                          <p className="text-[12px] text-slate-400 pt-1 border-t">※ 透過此圖可觀察使用參與度與學習投入強度之趨勢變動。</p>
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <button onClick={() => runPolicyAIForChart("practice_trend")} 
              className="flex items-center justify-center w-8 h-8 rounded-full text-emerald-500 hover:bg-emerald-50 transition">
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>

            <div className="flex items-center gap-1 mr-2 px-8 ">
              {["day", "week", "month"].map((mode) => (
                <button
                  key={mode} onClick={() => setViewMode(mode as any)}
                  className={`px-3 py-1 text-xs rounded-md transition ${viewMode === mode ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {mode === "day" ? "日線" : mode === "week" ? "週線" : "月線"}
                </button>
              ))}
            </div>

          <CardContent className="h-[350px] w-full">
          <Plot
            data={[
              {
                x: aggregatedTrend.map((t) => dayjs(t.activity_date).format("YYYY-MM-DD")),
                y: aggregatedTrend.map((t) => t.active_students),
                type: "bar", name: "活躍學生數",
                marker: { color: "rgba(34,197,94,0.35)" },
                hovertemplate: "活躍學生數：%{y}<extra></extra>",
              },
              {
                x: aggregatedTrend.map((t) => dayjs(t.activity_date).format("YYYY-MM-DD")),
                y: aggregatedTrend.map((t) => t.total_prac_count),
                type: "scatter", mode: "lines+markers", name: "練習總次數",
                line: { color: "#16a34a", width: 3 }, yaxis: "y2",
                hovertemplate: "練習次數：%{y}<extra></extra>",
              },
            ]}
            layout={{
              height: 350, margin: { t: 20, l: 50, r: 50, b: 70 }, barmode: "group",
              xaxis: {
                title: viewMode === "day" ? "日期" : viewMode === "week" ? "週起始日" : "月份",
                type: "category", tickangle: -45, tickfont: { size: 10, color: "#64748b" },
              },
              yaxis: { title: "活躍學生數", showgrid: true, zeroline: true },
              yaxis2: { title: "練習總次數", overlaying: "y", side: "right", showgrid: false, zeroline: false },
              legend: { orientation: "h", y: -0.25 },
              hovermode: "x unified",
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
          </CardContent>
        </Card>

        {/* ===== 正確率走勢 ===== */}
        <Card className="col-span-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-6">
            <CardTitle className="text-xl font-bold ">
              正確率走勢
              <span className="px-2 text-xs text-green-600">（ 科目：{selectedSubject} ）</span>
            </CardTitle>

            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f4fafb] shadow-xl border-emerald-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-emerald-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li><b className="text-emerald-700">{selectedCity}平均：</b>代表該區學生的實質掌握度。</li>
                          <li><b className="text-red-600">全部縣市平均：</b>作為基準線以判斷該區表現優於或低於全國平均。</li>
                        </ul>
                          <p className="text-[12px] text-slate-400 pt-1 border-t">※ 透過此圖可觀察{selectedCity}平均答題正確率與全部縣市平均之波動穩定度。</p>                       
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

               <button onClick={() => runPolicyAIForChart("effect_trend")} 
               className="flex items-center justify-center w-8 h-8 rounded-full text-emerald-500 hover:bg-emerald-50 transition">
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>

          <div className="flex items-center gap-1 mr-2 px-8">
            {["day", "week", "month"].map((mode) => (
              <button
                key={mode} onClick={() => setViewMode(mode as any)}
                className={`px-3 py-1 text-xs rounded-md transition ${viewMode === mode ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
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
                type: "scatter", mode: "lines+markers",
                name: selectedCity === "全部縣市" ? "全部縣市平均" : `${selectedCity}平均`,
                line: { color: "#16a34a", width: 3 },
                hovertemplate: "平均正確率：%{y:.1f}%<extra></extra>",
              },
              {
                x: aggregatedScoreTrend.map((d) => d.date),
                y: aggregatedScoreTrend.map((d) => d.base),
                type: "scatter", mode: "lines+markers",
                name: "全部縣市平均",
                line: { color: "#f05555ff", width: 2, dash: "dash" },
                hovertemplate: "全部縣市平均：%{y:.1f}%<extra></extra>",
              },
            ]}
            layout={{
              height: 350, margin: { t: 20, l: 50, r: 20, b: 40 },
              xaxis: { title: "日期", type: "category", tickangle: -45, tickfont: { size: 10, color: "#64748b" } },
              yaxis: { title: "平均答題正確率 (%)", range: [0, 105], ticksuffix: "%" },
              legend: { orientation: "h", y: -0.25 },
              hovermode: "x unified",
            }}
            style={{ width: "100%" }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </Card>
      </div>

      

        {/* ===== 校際差距走勢 ===== */}
          <Card 
          ref={scissorsGapRef} 
          className="col-span-1 relative scroll-mt-24 focus:ring-2 focus:ring-red-200 transition-all duration-500" // scroll-mt 確保滑動後不會被頂部導覽列遮住
        >
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-6">
            <CardTitle className="text-xl font-bold ">
              校際差距走勢
              <span className="px-2 text-xs text-green-600">（ 科目：{selectedSubject} ）</span>
            </CardTitle>

            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f4fafb] shadow-xl border-emerald-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-emerald-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li><b className="text-emerald-700">平均正確率 (左軸)：</b>整體學生表現趨勢。</li>
                          <li><b className="text-red-600">校際差距 (右軸)：</b>該時段各校平均分數的標準差。</li>
                        </ul>
                        
                          <p className="text-[12px] text-slate-400 pt-1 border-t">
                          ※ 若綠線上升但紅線也急遽上升，代表出現強者越強，弱者越弱的問題，需針對弱勢學校介入輔導。  
                          </p>               
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>


              <button
                onClick={() => runPolicyAIForChart("scissors_gap")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-emerald-500 hover:bg-emerald-50 transition"
              >
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>

          <CardContent className="h-[350px] w-full pt-0">
          <Plot
            data={[
              // 綠線：平均正確率 (左Y軸)
              {
                x: aggregatedScoreTrend.map((d) => d.date),
                y: aggregatedScoreTrend.map((d) => d.city),
                type: "scatter",
                mode: "lines+markers",
                name: "平均正確率",
                line: { color: "#16a34a", width: 3 },
                hovertemplate: "平均正確率：%{y:.1f}%<extra></extra>",
              },
              {
                x: aggregatedScoreTrend.map((d) => d.date),
                y: aggregatedScoreTrend.map((d) => d.baseStd), 
                type: "scatter",
                mode: "lines",
                name: "全國平均差距",
                line: { color: "#94a3b8", width: 2, dash: "dash" },
                yaxis: "y2",
                hovertemplate: "全國校際標準差：%{y:.2f}<extra></extra>",
              },
              // 紅色面積圖：校際差距/標準差 (右Y軸)
              {
                x: aggregatedScoreTrend.map((d) => d.date),
                y: aggregatedScoreTrend.map((d) => d.cityStd),
                type: "scatter",
                mode: "lines",
                name: "校際差距 (標準差)",
                line: { color: "#ef4444", width: 2, dash: "dot" },
                fill: "tozeroy",
                fillcolor: "rgba(239, 68, 68, 0.15)",
                yaxis: "y2",
                hovertemplate: "校際標準差：%{y:.2f}<extra></extra>",
              },
            ]}
            layout={{
              height: 350,
              margin: { t: 30, l: 70, r: 50, b: 80 },
              xaxis: {
                title: viewMode === "day" ? "日期" : viewMode === "week" ? "週起始日" : "月份",
                type: "category",
                tickangle: -45,
                tickfont: { size: 10, color: "#64748b" },
              },
              yaxis: {
                title: {
                    text: "平均答題正確率 (%)", 
                    font: { size: 10, color: '#64748b' },
                    standoff: 15
                  },
                range: [0, 105],
                ticksuffix: "%",
                titlefont: { color: '#16a34a' },
                tickfont: { color: '#16a34a' },
              },
              yaxis2: {
                title: {
                    text: "校際差距 (標準差)", 
                    font: { size: 10, color: '#64748b' },
                    standoff: 15
                  },
                overlaying: "y",
                side: "right",
                rangemode: "tozero",
                titlefont: { color: '#ef4444' },
                tickfont: { color: '#ef4444' },
                showgrid: false,
              },
              legend: { orientation: "h", y: -0.25 },
              hovermode: "x unified",
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
          </CardContent>
        </Card>


    </div>
  );
}