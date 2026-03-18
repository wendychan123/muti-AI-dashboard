import { useEffect, useMemo, useState, useRef } from "react";
import { useUserContext } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import dayjs from "dayjs";
import Plot from "react-plotly.js";
import _ from "lodash";
import { buildTeacherPracPrompt } from "@/lib/ai/buildTeacherPracPrompt";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Filter, Bot, HelpCircle, Activity, AlertTriangle, TrendingDown, Award } from "lucide-react";

/* =========================
Types
========================= */
interface SchoolPracDaily {
  user_id: number;
  organization_id: string; 
  grade: number;
  subject_name: string;
  indicator: string;
  indicate_name: string;
  activity_date: string;
  student_count: number;
  total_prac_count: number;
  total_time_sec: number;
  avg_score_rate: number;
}

interface IndicatorSummary {
  organization_id: string
  grade: number
  subject_name: string
  indicator: string
  indicate_name: string
  student_count: number
  total_prac_count: number
  school_total_student: number
  avg_score_rate: number
  avg_prac_per_student: number
  avg_time_sec: number
  participation_rate: number
}

interface SubjectSummary {
  city: string;
  organization_id: string;
  grade: number;
  subject_name: string;
  student_count: number;
  total_prac_count: number;
  total_time_sec: number;
  school_total_students: number;
  avg_score_rate: number;
  avg_time_sec: number;
  avg_prac_per_student: number;
  avg_time_per_student: number;
  participation_rate: number;
}


interface StudentAlert {
  organization_id: string
  grade: number;
  user_id: string;
  subject_name: string;
  indicator: string;
  indicate_name: string;
  mastery_status: string;
}

interface SchoolSummary {
  organization_id: string;
  grade: number;
  total_students: number; 
  avg_score_rate:number;
  total_prac_count:number
}

type TeacherPracChartTarget = 
  | "teacher_overview"   // 總覽
  | "diagnostic"         // 教學診斷指標 (四象限)
  | "participation"      // 作答參與度
  | "practice_trend"     // 練習投入走勢
  | "performance_trend"  // 學習成效走勢
  | "proficiency"        // 能力指標精熟度
  | "student_risk";      // 高風險學生與弱點指標




 /* =========================
     常數：顯示字串
  ========================= */
const ALL_GRADE = "全部年級";
const ALL_SUBJECT = "全部科目";


const uniqSorted = (arr: (string | number | null | undefined)[]) =>
  Array.from(new Set(arr.filter((v) => v !== null && v !== undefined)))
    .map((v) => String(v))
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));

/* =========================
     篩選狀態
  ========================= */
export default function TeacherPrac() {
  const { userInfo } = useUserContext();
  const organizationId = userInfo?.organization_id;

  const [pracData, setPracData] = useState<SchoolPracDaily[]>([]);
  const [schoolSummary, setSchoolSummary] = useState<SchoolSummary[]>([]);
  const [subjectSummary, setSubjectSummary] = useState<SubjectSummary[]>([]); 
  const [indicatorSummary, setIndicatorSummary] = useState<IndicatorSummary[]>([]);
  const [alertData, setAlertData] = useState<StudentAlert[]>([]);

  const [selectedGrade, setSelectedGrade] = useState(ALL_GRADE);
  const [selectedSubject, setSelectedSubject] = useState(ALL_SUBJECT);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");

  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiResult, setGeminiResult] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);


  /* =========================
  Load Data
  ========================= */
  useEffect(() => {
    if (!organizationId || !userInfo?.city) {
      setLoading(false); 
      return;
    }

    const loadData = async () => {
      setLoading(true); 
      try {
        const { data: prac } = await supabase
          .from("school_prac_daily")
          .select("*")
          .eq("organization_id", organizationId);

        const { data: indicator } = await supabase
          .from("school_indicator_summary")
          .select("*")
          .eq("organization_id", organizationId);

        const { data: subject } = await supabase
          .from("school_subject_summary")
          .select("*")
          .eq("city", userInfo.city);

        const { data: alert } = await supabase
          .from("school_indicator_alert")
          .select("*")
          .eq("organization_id", organizationId);

        const { data: summary } = await supabase
          .from("school_summary")
          .select("*")
          .eq("city", userInfo.city);

        setSchoolSummary(summary ?? []);
        setPracData(prac ?? []);
        setIndicatorSummary(indicator ?? []);
        setSubjectSummary(subject ?? []); 
        setAlertData(alert ?? []);
      } catch (error) {
        console.error("Data load error:", error);
      } finally {
        setLoading(false); 
      }
    };
    
    loadData();
  }, [organizationId, userInfo?.city]);

  /* =========================
      篩選邏輯
  ========================= */
  const filteredPrac = useMemo(() => {
    return pracData.filter((r) => {
      if (selectedGrade !== ALL_GRADE && r.grade !== Number(selectedGrade)) return false;
      if (selectedSubject !== ALL_SUBJECT && r.subject_name !== selectedSubject) return false;
      return true;
    });
  }, [pracData, selectedGrade, selectedSubject]);

  const filteredIndicator = useMemo(() => {
    return indicatorSummary.filter((r) => {
      if (selectedGrade !== ALL_GRADE && r.grade !== Number(selectedGrade)) return false;
      if (selectedSubject !== ALL_SUBJECT && r.subject_name !== selectedSubject) return false;
      return true;
    });
  }, [indicatorSummary, selectedGrade, selectedSubject]);

  const filteredSubjectSummary = useMemo(() => {
    return subjectSummary.filter((r) => {
      if (String(r.organization_id) !== String(organizationId)) return false;
      
      if (selectedGrade !== ALL_GRADE && r.grade !== Number(selectedGrade)) return false;
      if (selectedSubject !== ALL_SUBJECT && r.subject_name !== selectedSubject) return false;
      return true;
    });
  }, [subjectSummary, organizationId, selectedGrade, selectedSubject]);


  const filteredAlert = useMemo(() => {
    return alertData.filter((a) => {
      if (selectedGrade !== ALL_GRADE && a.grade !== Number(selectedGrade)) return false;
      if (selectedSubject !== ALL_SUBJECT && a.subject_name !== selectedSubject) return false;
      return true;
    });
  }, [alertData, selectedGrade, selectedSubject]);

  /* =========================
    下拉式選單
  ========================= */
  const gradeOptions = useMemo(() => uniqSorted(pracData.map((r) => r.grade)), [pracData]);
  const subjectOptions = useMemo(() => {
    let rows = pracData;
    if (selectedGrade !== ALL_GRADE) rows = rows.filter((r) => r.grade === Number(selectedGrade));
    return uniqSorted(rows.map((r) => r.subject_name));
  }, [pracData, selectedGrade]);


/* =========================
     計算資料期間
  ========================= */
  const periodLabel = useMemo(() => {
    if (filteredPrac.length === 0) return "資料期間：無數據";
    const dates = filteredPrac.map(d => d.activity_date).sort();
    const s = dayjs(dates[0]).format("YYYY/MM/DD");
    const e = dayjs(dates[dates.length - 1]).format("YYYY/MM/DD");
    const days = dayjs(dates[dates.length - 1]).diff(dayjs(dates[0]), "day") + 1;
    return `資料期間：${s} ～ ${e}（${days} 天）`;
  }, [filteredPrac]);


/* =========================
     新增 Ref 與滾動函數
  ========================= */
const proficiencyCardRef = useRef<HTMLDivElement>(null); 

// 建立跳轉函數
const scrollToUnmastered = () => {
  // 切換下方表格的過濾狀態為「未精熟」
  setFilterStatus('unmastered');
  
  // 滾動到該卡片位置
  proficiencyCardRef.current?.scrollIntoView({ 
    behavior: "smooth", 
    block: "center" 
  });
};



  /* =========================
     圖表一：練習投入走勢 
  ========================= */
  const aggregatedPracTrend = useMemo(() => {
    const map = new Map<string, { active_students: Set<string>; total_prac: number }>();

    filteredPrac.forEach((r) => {
      // 根據模式決定時間 Key
      const dateObj = dayjs(r.activity_date);
      const key = viewMode === "day" 
        ? dateObj.format("YYYY-MM-DD")
        : viewMode === "week" 
          ? dateObj.startOf("week").format("YYYY-MM-DD")
          : dateObj.startOf("month").format("YYYY-MM-DD");

      if (!map.has(key)) {
        map.set(key, { active_students: new Set(), total_prac: 0 });
      }

      const entry = map.get(key)!;
      // 如果資料中有 student_count 或 user_id，請依據實際資料結構調整
      // 這裡假設我們計算該區間內的活躍學生數
      if (r.student_count) entry.active_students.add(String(r.student_count)); 
      entry.total_prac += r.total_prac_count;
    });

    return Array.from(map.entries())
      .map(([date, val]) => ({
        date,
        active_students: val.active_students.size || 0, // 若資料結構無 ID，建議直接用 r.student_count
        total_prac_count: val.total_prac,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredPrac, viewMode]);

  /* =========================
     圖表：學習成效走勢 
    ========================= */
  const aggregatedScoreTrend = useMemo(() => {
    const map = new Map<string, { scoreSum: number; weight: number }>();

    filteredPrac.forEach((r) => {
      const dateObj = dayjs(r.activity_date);
      const key = viewMode === "day" 
        ? dateObj.format("YYYY-MM-DD")
        : viewMode === "week" 
          ? dateObj.startOf("week").format("YYYY-MM-DD")
          : dateObj.startOf("month").format("YYYY-MM-DD");

      if (!map.has(key)) {
        map.set(key, { scoreSum: 0, weight: 0 });
      }
      const entry = map.get(key)!;
      entry.scoreSum += r.avg_score_rate * r.total_prac_count;
      entry.weight += r.total_prac_count;
    });

    return Array.from(map.entries())
      .map(([date, v]) => ({
        date,
        avgScore: v.weight > 0 ? v.scoreSum / v.weight : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredPrac, viewMode]);



  /* =========================
     能力指標精熟長條圖 
    ========================= */
  const proficiencyList = useMemo(() => {
  const map = new Map();
  filteredPrac.forEach((r) => {
    const k = r.indicator || r.indicate_name;
    if (!map.has(k)) {
      map.set(k, { score: 0, weight: 0, fullName: r.indicate_name });
    }
    const curr = map.get(k);
    curr.score += (r.avg_score_rate || 0) * (r.total_prac_count || 0);
    curr.weight += (r.total_prac_count || 0);
  });

  return Array.from(map.entries()).map(([indicator, data]) => ({
    indicator,
    fullName: data.fullName,
    score: data.weight > 0 ? Math.round(data.score / data.weight) : 0,
  })).sort((a, b) => a.score - b.score);
}, [filteredPrac]);

{/* 新增定義按鈕與個數 */}
// 定義狀態過濾
const [filterStatus, setFilterStatus] = useState<'all' | 'unmastered' | 'mastered'>('all');

// 計算各狀態個數
const counts = useMemo(() => {
  return {
    unmastered: proficiencyList.filter(item => item.score < 100).length,
    mastered: proficiencyList.filter(item => item.score === 100).length,
  };
}, [proficiencyList]);

// 根據按鈕過濾顯示清單
const filteredDisplayList = useMemo(() => {
  if (filterStatus === 'unmastered') return proficiencyList.filter(item => item.score < 100);
  if (filterStatus === 'mastered') return proficiencyList.filter(item => item.score === 100);
  return proficiencyList;
}, [proficiencyList, filterStatus]);

  // 能力指標風險熱圖 
  // X: 能力指標, Y: 正確率區間 (0-60, 60-80, 80-100), Z: 學生人數
  const heatmapData = useMemo(() => {
    const indicators = Array.from(new Set(filteredPrac.map((r) => r.indicate_name)));
    const yLabels = ["待加強 (0-60)", "基礎 (60-85)", "精熟 (85-100)"];
    const zData = [new Array(indicators.length).fill(0), new Array(indicators.length).fill(0), new Array(indicators.length).fill(0)];

    filteredPrac.forEach((r) => {
      const xIdx = indicators.indexOf(r.indicate_name);
      if (r.avg_score_rate < 60) zData[0][xIdx] += r.student_count;
      else if (r.avg_score_rate < 85) zData[1][xIdx] += r.student_count;
      else zData[2][xIdx] += r.student_count;
    });
    return { x: indicators, y: yLabels, z: zData };
  }, [filteredPrac]);

  /* =========================
      學生風險排名表
    ========================= */
    const riskCardRef = useRef<HTMLDivElement>(null); // 用於捲動到該位置
    const [isRiskOnly, setIsRiskOnly] = useState(false); // 是否只顯示未精熟學生

    const handleKPI5Click = () => {
      setIsRiskOnly(!isRiskOnly); // 切換過濾狀態
      riskCardRef.current?.scrollIntoView({ behavior: 'smooth' }); // 平滑捲動
    };

  const studentRiskRanking = useMemo(() => {
  const map = new Map<string, { unmastered: number; total: number; names: string[] }>();
  
    filteredAlert.forEach((a) => {
      if (!map.has(a.user_id)) map.set(a.user_id, { unmastered: 0, total: 0, names: [] });
      const curr = map.get(a.user_id)!;
      curr.total += 1;
      if (a.mastery_status === "未精熟") {
        curr.unmastered += 1;
        // 收集指標名稱，過濾掉重複項
        if (!curr.names.includes(a.indicate_name)) curr.names.push(a.indicate_name);
      }
    });

    let list = Array.from(map.entries())
      .map(([userId, stats]) => ({
        userId,
        riskScore: (stats.unmastered / stats.total) * 100,
        unmasteredCount: stats.unmastered,
        unmasteredNames: stats.names.map(name => `- ${name}`).join("\n")
    }))
    .sort((a, b) => b.riskScore - a.riskScore);

    // 聯動邏輯：如果 KPI 5 被啟動，則過濾只剩未精熟學生
    if (isRiskOnly) {
      list = list.filter(s => s.unmasteredCount > 0);
    }

    return list;
  }, [filteredAlert, isRiskOnly]);

  

  /* =========================
     KPI
  ========================= */
const kpi = useMemo(() => {
  // --- 1. 基本數據 (來自 filteredPrac，代表本校且受篩選器影響的練習數據) ---
  const totalPrac = filteredPrac.reduce((s, r) => s + (r.total_prac_count || 0), 0);
  const totalTime = filteredPrac.reduce((s, r) => s + (r.total_time_sec || 0), 0);
  const scoreWeighted = filteredPrac.reduce((s, r) => s + (r.avg_score_rate || 0) * (r.total_prac_count || 0), 0);
  const avgScore = totalPrac > 0 ? scoreWeighted / totalPrac : 0;

  // --- 2. 縣市比較邏輯 (基準線) ---
  
  // A. 判定該行政區內有多少間不重複的學校
  // uniqueSchools 會列出 schoolSummary 中所有不同的 organization_id
  const uniqueSchools = _.uniqBy(schoolSummary, "organization_id");
  const hasMultipleSchools = uniqueSchools.length > 1;

  // B. 根據選擇的年級篩選出「全縣市」的資料列
  const cityMatchedRows = selectedGrade === ALL_GRADE 
    ? schoolSummary 
    : schoolSummary.filter(s => String(s.grade) === String(selectedGrade));

  // C. 計算全市加權平均
  const cityTotalPrac = _.sumBy(cityMatchedRows, "total_prac_count");
  const cityScoreWeighted = cityMatchedRows.reduce((s, r) => s + ((r.avg_score_rate || 0) * (r.total_prac_count || 0)), 0);
  const cityAvgScore = cityTotalPrac > 0 ? cityScoreWeighted / cityTotalPrac : 0;

  // --- 3. 學生人數計算 (精確鎖定「本校」) ---
  // 使用您提供的 userInfo?.organization_id 作為比對基準
  const currentOrgId = userInfo?.organization_id;

  // 從包含全縣市的 schoolSummary 中過濾出僅屬於本校的列
  const currentSchoolRows = schoolSummary.filter(s => String(s.organization_id) === String(currentOrgId));

  let totalSchoolStudents = 0;
  if (selectedGrade === ALL_GRADE) {
    // 全部年級：加總本校所有年級的人數
    totalSchoolStudents = _.sumBy(currentSchoolRows, "total_students");
  } else {
    // 特定年級：篩選本校該年級的人數
    const matchedGradeData = currentSchoolRows.find(s => String(s.grade) === String(selectedGrade));
    totalSchoolStudents = matchedGradeData?.total_students || 0;
  }

  // --- 4. 其他統計指標 ---
  const practicedStudents = new Set(filteredAlert.map(a => a.user_id));
  const totalStudents = practicedStudents.size;
  
  // 參與率 = (有練習的不重複學生數 / 該校該年級總人數) * 100
  const participationRate = totalSchoolStudents > 0 ? (totalStudents / totalSchoolStudents) * 100 : 0;
  const avgPracPerStudent = totalStudents > 0 ? totalPrac / totalStudents : 0;

  // 未精熟統計
  const notMasteredIndicators = proficiencyList.filter(item => item.score < 100).length;
  const notMasteredStudents = new Set(
    filteredAlert
      .filter(a => a.mastery_status === "未精熟")
      .map(a => a.user_id)
  ).size;

  return {
    totalStudents,
    totalSchoolStudents,
    participationRate,
    avgScore,
    cityAvgScore,
    hasMultipleSchools, 
    avgPracPerStudent,
    totalTime,
    notMasteredStudents,
    notMasteredIndicators,
  };
}, [filteredPrac, filteredAlert, proficiencyList, schoolSummary, selectedGrade, userInfo?.organization_id]);


/* =========================
     教學診斷指標 
  ========================= */
const quadrantData = useMemo(() => {
  const rows = filteredIndicator.map(r => ({
    name: r.indicate_name,
    // 修改：改用人均作答次數 (total_prac_count / 學生數) 作為 X 軸
    // 假設 r 裡面有該指標的總作答次數與學生數
    avgCount: r.total_prac_count / (r.student_count || 1), 
    avgScore: r.avg_score_rate ?? 0
  }));

  const xValues = rows.map(r => r.avgCount);
  const yValues = rows.map(r => r.avgScore);

  // X 軸基準：採用中位數，代表區域或班級的平均參與水準
  const sortedX = [...xValues].sort((a, b) => a - b);
  const xAvg = sortedX.length > 0 ? sortedX[Math.floor(sortedX.length / 2)] : 5;

  // Y 軸基準：固定在 60% 作為及格/精熟邊界
  const yAvg = 60; 

  return {
    rows,
    xAvg,
    yAvg,
    xMax: Math.max(...xValues, 10)
  };
}, [filteredIndicator]);

/* =========================
     作答參與度
  ========================= */
const participationData = useMemo(() => {
  const data = filteredIndicator
    .map((r) => ({
      name: r.indicator,
      fullName: r.indicate_name,
      rate: r.participation_rate ?? 0,
      students: r.student_count ?? 0,
    }))
    .sort((a, b) => b.rate - a.rate);

  
  const dynamicHeight = Math.max(250, data.length * 10); 
  return { data, dynamicHeight };
}, [filteredIndicator]);

/* =========================
     AI 助手功能
  ========================= */
const runTeacherAIForChart = async (target: TeacherPracChartTarget | "teacher_overview") => {
  setGeminiLoading(true);
  const chartLabel = TEACHER_CHART_LABELS[target] || "全校練習表現";

  // 1. 構建發送給 AI 的 Context (根據 buildTeacherPracPrompt 結構)
  const prompt = buildTeacherPracPrompt({
    city: String(userInfo.city || ""), 
    organization_id: String(userInfo.organization_id || ""),
    grade: selectedGrade,
    subject: selectedSubject,
    period: periodLabel,
    // 傳入當前畫面上的 KPI 數據
    stats: {
      totalStudents: kpi.totalStudents,
      avgScore: kpi.avgScore,
      avgPracPerStudent: kpi.avgPracPerStudent,
      notMasteredStudents: kpi.notMasteredStudents,
      notMasteredIndicators: kpi.notMasteredIndicators,
    },
    selectedCharts: [target],
  });

  // 2. 觸發 UI 上的 Loading 狀態 (對應導覽列的 AI 視窗)
  window.dispatchEvent(
    new CustomEvent("teacher-ai-update", {
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
        role: "teacher_diagnostic", 
      }),
    });

    const data = await res.json();

    // 3. 發送分析結果回 UI
    window.dispatchEvent(
      new CustomEvent("teacher-ai-update", {
        detail: {
          loading: false,
          content: data.text,
        },
      })
    );
  } catch (err) {
    console.error("Teacher AI error:", err);
    window.dispatchEvent(
      new CustomEvent("teacher-ai-update", {
        detail: { loading: false, content: "AI 診斷暫時無法連線，請稍後再試。" },
      })
    );
  } finally {
    setGeminiLoading(false);
  }
};


const TEACHER_CHART_LABELS: Record<TeacherPracChartTarget, string> = {
  teacher_overview: "總覽練習表現",
  diagnostic: "教學診斷指標",
  participation: "作答參與度",
  practice_trend: "練習投入走勢",
  performance_trend: "學習成效走勢",
  proficiency: "能力指標精熟度",
  student_risk: "高風險學生與弱點指標",
};

/* =========================
   監聽多圖整合分析 
========================= */
useEffect(() => {
  const handler = async (e: Event) => {
    // 1. 基本檢查：確認事件包含資料，且目前的 kpi 已運算完成
    const detail = (e as CustomEvent<{ charts: string[] }>).detail;
    if (!detail || !detail.charts?.length) return;
    if (!kpi) return; 

    // 2. 過濾出符合 TeacherPrac 定義的圖表目標
    const selected: TeacherPracChartTarget[] = detail.charts.filter(
      (c): c is TeacherPracChartTarget => c in TEACHER_CHART_LABELS
    );

    if (selected.length === 0) return;

    setGeminiLoading(true);

    // 取得人類可讀的標題（用於 UI 顯示正在分析哪些問題）
    const chartLabels = selected.map((c) => TEACHER_CHART_LABELS[c]);

    // 3. 構建 Prompt：傳入班級篩選條件與 KPI 數據
    const prompt = buildTeacherPracPrompt({
      city: String(userInfo.city || ""), 
      organization_id: String(userInfo.organization_id || ""),
      grade: selectedGrade,        
      subject: selectedSubject,
      period: periodLabel,
      selectedCharts: selected, 

      stats: {
        totalStudents: kpi.totalStudents,
        avgScore: kpi.avgScore,
        avgPracPerStudent: kpi.avgPracPerStudent,
        notMasteredStudents: kpi.notMasteredStudents,   
        notMasteredIndicators: kpi.notMasteredIndicators 
      },
    });

    // 🔹 觸發 UI Loading 狀態
    window.dispatchEvent(
      new CustomEvent("teacher-ai-update", {
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
          role: "teacher_diagnostic", // 指定後端處理角色
        }),
      });

      if (!res.ok) throw new Error("AI 服務回應異常");
      const data = await res.json();

      // 🔹 發送分析完成內容
      window.dispatchEvent(
        new CustomEvent("teacher-ai-update", {
          detail: {
            loading: false,
            content: data.text,
          },
        })
      );
    } catch (err) {
      console.error("Teacher Multi AI error:", err);

      window.dispatchEvent(
        new CustomEvent("teacher-ai-update", {
          detail: {
            loading: false,
            content: "AI 整合分析失敗，請檢查網路連線或稍後再試。",
          },
        })
      );
    } finally {
      setGeminiLoading(false);
    }
  };

  window.addEventListener("teacher-ai-multi-request", handler);

  return () => {
    window.removeEventListener("teacher-ai-multi-request", handler);
  };
}, [
  // 當這些相依項改變時，重新建立監聽器以捕捉最新的資料閉包
  selectedGrade,
  selectedSubject,
  periodLabel,
  kpi, 
]);

/* =========================
   對過長的指標名稱進行換行
========================= */
const wrapText = (str, len = 20) => {
  if (!str) return "";
  const reg = new RegExp(`(.{${len}})`, "g");
  return str.replace(reg, "$1<br>");
};

const formatHoverText = (str: string, maxLength = 22) => {
  if (!str) return "";
  const res = str.match(new RegExp(`.{1,${maxLength}}`, "g"));
  return res ? res.join("<br>") : str;
};



/* =========================
     Render
  ========================= */
  return (
    <div className="min-h-screen p-4 space-y-6">
      {/* 篩選器 */}
      <div className="flex flex-wrap items-center gap-2 p-3 ">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Filter className="w-4 h-4" />
        </div>

        {/* 年級 */}
        <span className="text-sm">年級：</span>
        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
          <SelectTrigger className="w-[120px] bg-white border rounded"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_GRADE}>全部年級</SelectItem>
            {gradeOptions.map((grade) => <SelectItem key={grade} value={grade}>{grade} 年級</SelectItem>)}
          </SelectContent>
        </Select>


        {/* 科目 */}
         <span className="text-sm">科目：</span>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-[150px] bg-white border rounded"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SUBJECT}>全部科目</SelectItem>
            {subjectOptions.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* AI 分析按鈕 */}
          <button
            onClick={() => runTeacherAIForChart("teacher_overview")}
            disabled={geminiLoading}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition shadow-sm
              ${
                geminiLoading
                  ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                  : "bg-violet-500 text-white hover:bg-violet-700"
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
          KPI 區 (參考圖設計)
    ========================= */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

        {/* KPI 1: 學生母數 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            練習學生數
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-3xl font-black text-slate-800 tracking-tight">
              {kpi.totalStudents.toLocaleString()}
            </div>
            <div className="text-[11px] text-center text-slate-400 ">總學生數{kpi.totalSchoolStudents.toLocaleString()}人<br/>(參與率{kpi.participationRate.toFixed(1)}%)</div>
          </div>
        </div>

        {/* KPI 2: 平均正確率 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            平均答對率
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <div className="text-3xl font-black tracking-tight text-slate-800">
              {kpi.avgScore.toFixed(1)}%
            </div>
            
            <div className="mt-1 flex flex-col items-center">
              {kpi.hasMultipleSchools ? (
                <>
                  <span className="text-[11px] text-slate-400">
                    全市平均 {kpi.cityAvgScore.toFixed(1)}%
                  </span>
                  {kpi.avgScore >= kpi.cityAvgScore ? (
                    <span className="text-[11px] text-emerald-600 font-bold">
                      （↑ {(kpi.avgScore - kpi.cityAvgScore).toFixed(1)}%）
                    </span>
                  ) : (
                    <span className="text-[11px] text-rose-500 font-bold">
                      （↓ {(kpi.cityAvgScore - kpi.avgScore).toFixed(1)}%）
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  目前為該行政區唯一數據
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI 3: 練習時數 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            平均練習時間
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-3xl font-black text-slate-800 tracking-tight text-green-600">
              {(kpi.totalTime / (kpi.totalStudents || 1) / 60).toFixed(0)} <span className="text-lg">分</span>
            </div>
          </div>
        </div>

        {/* KPI 4: 未精熟能力指標數 (可點擊) */}
        <div 
          onClick={scrollToUnmastered}
          className="flex flex-col border border-rose-200 rounded-md overflow-hidden shadow-sm bg-white cursor-pointer hover:shadow-md transition-all active:scale-95 group"
        >
          <div className="bg-rose-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-rose-200 group-hover:bg-rose-600">
            未精熟能力指標
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-3xl font-black text-rose-600 tracking-tight">
              {kpi.notMasteredIndicators}
            </div>
            <div className="text-[11px] text-slate-500  animate-pulse">點擊查看清單</div>
          </div>
        </div>

        {/* KPI 5: 未精熟人數 (可過濾) */}
        <div 
          onClick={handleKPI5Click}
          className={`flex flex-col border rounded-md overflow-hidden shadow-sm transition-all cursor-pointer active:scale-95 group ${
            isRiskOnly ? 'ring-2 ring-rose-500 bg-rose-50 border-red-900' : 'bg-white border-rose-200'
          }`}
        >
          <div className={`text-white text-sm font-bold py-2.5 px-3 text-center border-b ${
            isRiskOnly ? 'bg-rose-500 border-rose-200' : 'bg-rose-500 border-rose-200 group-hover:bg-rose-600'
          }`}>
            {isRiskOnly ? '未精熟人數' : '未精熟人數'}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className={`text-3xl font-black tracking-tight ${kpi.notMasteredStudents > 0 ? "text-rose-600" : "text-slate-800"}`}>
              {kpi.notMasteredStudents}
            </div>
            <div className={`text-[11px] ${isRiskOnly ? 'text-rose-600' : 'text-slate-400'}`}>
              {isRiskOnly ? '點擊取消過濾' : '點擊查看名單'}
            </div>
          </div>
        </div>

      </div>



      {/* =========================
                圖表區
      ========================= */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ===== 教學診斷指標 ===== */}
        <Card className="col-span-2 relative">
           {loading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Activity className="animate-spin mr-2 w-4 h-4" />
                <span className="text-sm text-slate-600">資料分析中...</span>
              </div>
            )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
            {/* 左側：標題 */}
            <CardTitle className="text-xl font-bold ">
              教學診斷指標
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
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f8fafc] shadow-2xl border-slate-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-violet-900 flex items-center gap-1">圖表診斷說明：</p>
                        <ul className="text-xs space-y-2.5">
                          <li className="flex gap-2">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-1" />
                            <span>
                              <b className="text-blue-700">精熟區 (高次數、高得分)：</b>
                              代表學生透過頻繁練習且維持高正確率。此指標掌握度極佳，建議可進入下一階段學習。
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1" />
                            <span>
                              <b className="text-emerald-700">潛力區 (低次數、高得分)：</b>
                              代表學生練習次數不多即獲得高分。可能是指標難度較低，或是學生已具備深厚的先備知識。
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1" />
                            <span>
                              <b className="text-amber-700">低參與 (低次數、低得分)：</b>
                              代表實質練習量不足。應優先引導學生進行基本作答，累積足夠的互動數據以利後續診斷。
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-rose-500 mt-1" />
                            <span>
                              <b className="text-rose-700">瓶頸區 (高次數、低得分)：</b>
                              <b>關鍵警示！</b>代表學生嘗試多次練習但成效不佳。此為核心學習障礙，需優先介入輔導。
                            </span>
                          </li>
                        </ul>
                        <p className="text-[12px] text-slate-400 pt-1 border-t leading-relaxed">
                          ※ 本圖以<b>「人均練習次數」</b>作為 X 軸，排除無效掛機時間，真實反映學生與學習內容的互動頻率與成效。
                        </p>              
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
              <button
                onClick={() => runTeacherAIForChart("diagnostic")}
                className="
                  flex items-center justify-center
                  w-8 h-8
                  rounded-full
                  text-violet-500
                  hover:bg-violet-50
                  transition
                "
              >
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>
          
            
          <CardContent className="h-[260px] w-full">
            <Plot
              data={[
                {
                  x: quadrantData.rows.map(r => r.avgCount),
                  y: quadrantData.rows.map(r => r.avgScore),
                  mode: "markers",
                  marker: {
                    size: 12,
                    color: quadrantData.rows.map(r => 
                      r.avgScore >= quadrantData.yAvg 
                        ? (r.avgCount >= quadrantData.xAvg ? "rgba(37, 100, 235, 1)" : "rgba(22, 163, 74, 1)") 
                        : (r.avgCount >= quadrantData.xAvg ? "rgba(220, 38, 38, 1)" : "rgba(238, 159, 49, 1)") 
                    ),
                    opacity: 0.6,
                    line: { color: 'white', width: 1 }
                  },
                  text: quadrantData.rows.map(r => wrapText(r.name, 20)),
                  hovertemplate: 
                    "<b>能力指標：%{text}</b><br>" +
                    "實質參與：%{x:.1f} 次練習<br>" + 
                    "平均正確率：%{y:.1f}%<br>" +
                    "<extra></extra>",
                  hoverlabel: { align: "left", namelength: -1 }
                }
              ]}
              layout={{
                height: 260,
                margin: { t: 30, r: 30, b: 60, l: 60 }, // 增加左邊距以容納 Y 軸標題
                xaxis: { 
                  title: {
                    text: "人均練習次數 (實質參與度)", // X 軸數值名稱
                    font: { size: 12, color: '#64748b' },
                    standoff: 15
                  },
                  gridcolor: '#f1f5f9',
                  zeroline: false 
                },
                yaxis: { 
                  title: {
                    text: "平均正確率 (%)", // Y 軸數值名稱
                    font: { size: 12, color: '#64748b' },
                    standoff: 15
                  },
                  range: [0, 110], 
                  gridcolor: '#f1f5f9',
                  zeroline: false 
                },
                shapes: [
                  { type: "line", x0: quadrantData.xAvg, x1: quadrantData.xAvg, y0: 0, y1: 100, line: { color: "#94a3b8", dash: "dot", width: 2 } },
                  { type: "line", x0: 0, x1: quadrantData.xMax * 1.1, y0: quadrantData.yAvg, y1: quadrantData.yAvg, line: { color: "#94a3b8", dash: "dot", width: 2 } },
                ],
                annotations: [
                  { x: quadrantData.xMax, y: 105, text: "<b>精熟區</b>", showarrow: false, xanchor: 'right', font: { color: "#2563eb" } },
                  { x: 0, y: 105, text: "<b>潛力區</b>", showarrow: false, xanchor: 'left', font: { color: "#16a34a" } },
                  { x: 0, y: 5, text: "<b>低參與</b>", showarrow: false, xanchor: 'left', font: { color: "#ea580c" } },
                  { x: quadrantData.xMax, y: 5, text: "<b>瓶頸區</b>", showarrow: false, xanchor: 'right', font: { color: "#dc2626" } },
                ]
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "100%" }}
            />
          </CardContent>
        </Card>
        
        {/* ===== 作答參與度 ===== */}
        <Card className="col-span-1 lg:col-span-2 relative">

          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-2">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              作答參與度
            </CardTitle>

            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 transition">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#f8fafc] shadow-2xl border-slate-200 text-slate-700 z-50">
                    <div className="space-y-3">
                      <p className="font-bold border-b pb-1 text-violet-900 flex items-center gap-1">圖表指標說明：</p>
                      <ul className="text-xs space-y-2.5">
                        <li className="flex gap-2">
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-slate-400 mt-1" />
                          <span><b className="text-slate-700">參與率 (長條)：</b>該指標已作答人數佔班級總人數的百分比。</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-violet-400 mt-1" />
                          <span><b className="text-violet-700">學生數 (折線)：</b>實際參與該練習的具體人數。</span>
                        </li>
                      </ul>
                      <p className="text-[12px] text-slate-400 pt-1 border-t">
                        ※ 透過此圖可觀察參與率低且人數少的指標，確認是否為進度尚未排入或學生遺漏練習。
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
              <button
                onClick={() => runTeacherAIForChart("participation")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-violet-500 hover:bg-violet-50 transition">
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>

          <CardContent className="h-[260px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
            <div style={{ height: participationData.dynamicHeight }}>
              <Plot
                data={[
                  {
                    // 透明 Layer 用於顯示完整指標名稱的 Hover
                    x: participationData.data.map((d) => d.rate),
                    y: participationData.data.map((d) => d.name),
                    customdata: participationData.data.map((d) => formatHoverText(d.fullName, 20)), 
                    mode: "markers",
                    marker: { color: "transparent" },
                    hovertemplate: "<span style='font-size: 13px; font-weight: bold;'>%{customdata}</span><extra></extra>", 
                    showlegend: false,
                  },
                  {
                    x: participationData.data.map((d) => d.rate),
                    y: participationData.data.map((d) => d.name),
                    type: "bar",
                    name: "參與率",
                    orientation: "h",
                    marker: {
                      color: participationData.data.map(d =>
                        d.rate < 40 ? "#fda4af" : d.rate < 70 ? "#fcd34d" : "#c4b5fd"
                      ),
                    },
                    hovertemplate: "參與率：%{x:.1f}%<extra></extra>",
                    hoverlabel: {
                      align: "left",
                      namelength: -1,
                      bgcolor: "#fff",
                      bordercolor: "#e2e8f0",
                      font: { size: 12, color: "#1e293b" }
                    }
                  },
                  {
                    x: participationData.data.map((d) => d.students),
                    y: participationData.data.map((d) => d.name),
                    type: "scatter",
                    mode: "lines+markers",
                    name: "參與人數",
                    xaxis: "x2", // 連結到頂部的 X2 軸
                    line: { color: "rgb(76 29 149)", width: 2 },
                    marker: { size: 6 },
                    hovertemplate: "實際人數：%{x} 人<extra></extra>",
                  },
                ]}
                layout={{
                  autosize: true,
                  height: participationData.dynamicHeight,
                  margin: { l: 30, r: 30, t: 35, b: 60 }, // 增加邊距以容納標題
                  showlegend: false,
                  xaxis: {
                    title: {
                      text: "參與率 (%)", // X1 軸名稱 (底部)
                      font: { size: 12, color: '#64748b' },
                      standoff: 15
                    },
                    range: [0, 105],
                    side: "bottom",
                    tickfont: { size: 10 },
                    gridcolor: "#f1f5f9",
                    zeroline: false
                  },
                  xaxis2: {
                    title: {
                      text: "實際作答人數 (人)", // X2 軸名稱 (頂部)
                      font: { size: 12, color: "rgb(76 29 149)" },
                      standoff: 15
                    },
                    overlaying: "x",
                    side: "top",
                    showgrid: false,
                    zeroline: false,
                    tickfont: { size: 10, color: "rgb(76 29 149)" },
                  },
                  yaxis: {
                    title: {
                      text: "能力指標", // Y 軸名稱
                      font: { size: 12, color: '#64748b' },
                      standoff: 10
                    },
                    automargin: true,
                    tickfont: { size: 10, color: "#64748b" },
                  },
                  hovermode: "y unified",
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", height: "100%" }}
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
            {/* 左側：標題 */}
            <CardTitle className="text-xl font-bold ">
              練習投入走勢
              <span className="px-2 text-xs text-violet-600">（ 科目：{selectedSubject} ）</span>
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
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#faf9fb] shadow-2xl border-violet-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-violet-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li>
                            <b className="text-violet-600">活躍學生數 (長條圖)：</b>
                            指該日/週/月班級內有實際進行作答的學生人數
                          </li>
                          <li>
                            <b className="text-violet-600">練習總次數 (折線圖)：</b>
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
                onClick={() => runTeacherAIForChart("practice_trend")}
                className="
                  flex items-center justify-center
                  w-8 h-8
                  rounded-full
                  text-violet-500
                  hover:bg-violet-50
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
                        ? "bg-violet-600 text-white shadow"
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
                  x: aggregatedPracTrend.map(t => t.date),
                  y: aggregatedPracTrend.map(t => t.active_students),
                  type: "bar",
                  name: "活躍學生數",
                  marker: { color: "rgba(139, 92, 246, 0.3)" },
                  hovertemplate: "活躍學生：%{y}人<extra></extra>",
                },
                {
                  x: aggregatedPracTrend.map(t => t.date),
                  y: aggregatedPracTrend.map(t => t.total_prac_count),
                  type: "scatter",
                  mode: "lines+markers",
                  name: "練習總次數",
                  line: { color: "#7c3aed", width: 3 },
                  yaxis: "y2",
                  hovertemplate: "練習次數：%{y}次<extra></extra>",
                },
              ]}
              layout={{
                autosize: true,
                margin: { t: 30, l: 40, r:30, b: 50 },
                xaxis: { type: "category", tickangle: -35, tickfont: { size: 10 } ,color: "#64748b" },
                yaxis: { title: "活躍學生數", side: "left", showgrid: true, zeroline: true},
                yaxis2: { title: "練習總次數", overlaying: "y", side: "right", showgrid: false, zeroline: false },
                legend: { orientation: "h", y: -0.25 },
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
              <span className="px-2 text-xs text-violet-600">（ 科目：{selectedSubject} ）</span>
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
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#faf9fb] shadow-2xl border-violet-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-violet-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li>
                            <b className="text-slate-700 font-bold">學校平均：</b>
                            顯示目前該校在特定單元下的平均正確率走勢，反映全校整體的理解程度。
                          </li>
                          <li>
                            <b className="text-slate-600 font-bold">總平均：</b>
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
                onClick={() => runTeacherAIForChart("performance_trend")}
                className="
                  flex items-center justify-center
                  w-8 h-8
                  rounded-full
                  text-violet-500
                  hover:bg-violet-50
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
                      ? "bg-violet-600 text-white"
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
                // 趨勢線：當前時間區間的平均正確率
                {
                  x: aggregatedScoreTrend.map((d) => d.date),
                  y: aggregatedScoreTrend.map((d) => d.avgScore),
                  type: "scatter",
                  mode: "lines+markers",
                  name: "當前期間平均",
                  line: { color: "#7c3aed", width: 3, shape: 'spline' }, 
                  hovertemplate: "平均正確率：%{y:.1f}%<extra></extra>",
                },
                // 動態基準線：kpi.avgScore (該篩選條件下的全局平均)
                {
                  x: aggregatedScoreTrend.map((d) => d.date),
                  y: aggregatedScoreTrend.map(() => kpi.avgScore),
                  type: "scatter",
                  mode: "lines",
                  name: `總平均 (${kpi.avgScore.toFixed(1)}%)`,
                  line: {
                    color: "#f05555",
                    width: 3,
                    dash: "dash",
                  },
                  hoverinfo: "skip", 
                },
              ]}
              layout={{
                height: 350,
                margin: { t: 30, l: 50, r: 40, b: 50 },
                xaxis: {
                  title: viewMode === "day" ? "日期" : viewMode === "week" ? "週起始日" : "月份",
                  type: "category",
                  tickangle: -45,
                  tickfont: { size: 10, color: "#64748b" },
                },
                yaxis: {
                  title: "平均答題正確率 (%)",
                  range: [0, 105],
                  ticksuffix: "%",
                  gridcolor: "#f1f5f9",
                },
                legend: {
                  orientation: "h",
                  y: -0.3,
                },
                hovermode: "x unified",
              }}
              style={{ width: "100%", height: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* 能力指標精熟度診斷 */}
        <Card className="col-span-1 shadow-sm relative overflow-hidden" ref={proficiencyCardRef}>
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}
          
          <CardHeader className="flex flex-row items-center justify-between py-4 pb-2">
            {/* 左側：標題 */}
            <CardTitle className="text-xl font-bold text-slate-700">
              能力指標精熟度
              <span className="px-2 text-xs text-violet-600">（ 科目：{selectedSubject} ）</span>
            </CardTitle>

            {/* 右側：按鈕群組 */}
            <div className="flex items-center gap-1">
              {/* 圖表說明 Tooltip：重新改寫 */}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 transition">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#faf9fb] shadow-2xl border-violet-200 text-slate-700 z-50">
                    <div className="space-y-3">
                      <p className="font-bold border-b pb-1 text-violet-700"> 表格計算說明：</p>
                      <ul className="text-xs space-y-2 list-disc pl-4">
                        <li>
                          <b className="text-slate-700 font-bold">未精熟 (紅色 0-59%)：</b>
                          代表學校對該指標理解薄弱，建議立即進行全校性補救教學。
                        </li>
                        <li>
                          <b className="text-slate-700 font-bold"> (黃色 60-99%)：</b>
                          已具備基本認知，但穩定度不足，建議增加進階練習。
                        </li>
                        <li>
                          <b className="text-slate-700 font-bold">已精熟 (紫色 100%)：</b>
                          完全掌握該指標內容，可進行下一階段教學。
                        </li>
                      </ul>
                      <p className="text-[12px] text-slate-400 pt-1 border-t">
                        ※ 數據採用加權正確率計算，反映出真實學習狀態。
                      </p>
                    </div>
                  </TooltipContent>                    
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
              <button
                onClick={() => runTeacherAIForChart("proficiency")}
                className="
                  flex items-center justify-center
                  w-8 h-8
                  rounded-full
                  text-violet-500
                  hover:bg-violet-50
                  transition
                "
              >
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>

          {/* 過濾按鈕群組：提高並優化間距 */}
          <div className="flex flex-wrap gap-2 px-6 py-2 bg-slate-50/50 border-slate-100">
            <button 
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${filterStatus === 'all' ? 'bg-slate-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
            >
              全部指標 ({proficiencyList.length})
            </button>
            <button 
              onClick={() => setFilterStatus('unmastered')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${filterStatus === 'unmastered' ? 'bg-rose-500 text-white' : 'bg-white text-rose-500 border border-rose-200 hover:bg-rose-50'}`}
            >
              未精熟 ({counts.unmastered})
            </button>
            <button 
              onClick={() => setFilterStatus('mastered')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${filterStatus === 'mastered' ? 'bg-violet-600 text-white' : 'bg-white text-violet-600 border border-violet-200 hover:bg-violet-50'}`}
            >
              已精熟 ({counts.mastered})
            </button>
          </div>

          <CardContent className="p-0">
            <div className="max-h-[350px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white/95 backdrop-blur-sm shadow-sm z-10">
                  <tr className="text-xs text-slate-500 border-b">
                    <th className="p-2 font-bold w-40 text-center">能力指標</th>
                    <th className="p-2 font-bold">單元精熟進度</th>
                    <th className="p-2 font-bold w-40 text-center">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredDisplayList.map((item) => {
                    let barColor = "bg-violet-300"; 
                    if (item.score < 60) barColor = "bg-rose-300"; 
                    else if (item.score < 100) barColor = "bg-amber-300"; 

                    return (
                      <tr key={item.indicator} className="hover:bg-slate-50/80 transition-colors group cursor-pointer">
                        <td className="p-4 text-sm font-mono font-bold text-slate-600 text-center">
                          {item.indicator}
                        </td>
                        
                        <td className="p-3">
                          <div className="flex flex-col">
                            <div className="w-full bg-slate-100 rounded-full h-5 relative border border-slate-200 shadow-inner overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-700 flex items-center justify-center ${barColor}`}
                                style={{ width: `${item.score}%` }}
                              >
                                <span className="text-[10px] font-black text-slate-800">
                                  {item.score}%
                                </span>
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-400 font-medium truncate w-full pl-1">
                              {item.fullName}
                            </span>
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          {item.score < 100 ? (
                            <span className={`px-2 py-1 text-[11px] rounded border font-bold ${item.score < 60 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                              未精熟
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-violet-50 text-violet-600 text-[11px] rounded border border-violet-100 font-bold whitespace-nowrap">
                              已精熟
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* 待關注學生名單 */}
          <Card className="col-span-1 shadow-sm relative overflow-hidden"  ref={riskCardRef}>
            {loading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Activity className="animate-spin mr-2 w-4 h-4" />
                <span className="text-sm text-slate-600">資料分析中...</span>
              </div>
            )}
          
          <CardHeader className="flex flex-row items-center justify-between py-4 pb-2">
            {/* 左側：標題 */}
            <CardTitle className="text-xl font-bold text-slate-700">
              高風險學生與弱點指標 <span className="px-2 text-xs text-violet-600">（ 科目：{selectedSubject} ）</span>
              
              {isRiskOnly && <span className="px-2 text-xs font-normal bg-rose-500 text-white">（已過濾未精熟名單）</span>}
            </CardTitle>
              
              {/* Tooltip 說明 */}
              <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-slate-400 hover:text-slate-600"><HelpCircle className="w-5 h-5" /></button>
                  </TooltipTrigger>                 
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#faf9fb] shadow-2xl border-violet-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-violet-700"> 表格計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li>
                            <b className="text-slate-700 font-bold">未精熟指標：</b>
                            指正確率未達及格標準之能力單元。
                          </li>
                          <li>
                            <b className="text-slate-700 font-bold"> 風險比例：</b>
                            未精熟指標佔該生總作答指標之比例。
                          </li>                        
                        </ul>                        
                      </div>
                    </TooltipContent> 
                </Tooltip>
              </TooltipProvider>

                {/* AI 分析按鈕 */}
                <button
                  onClick={() => runTeacherAIForChart("proficiency")}
                  className="
                    flex items-center justify-center
                    w-8 h-8
                    rounded-full
                    text-violet-500
                    hover:bg-violet-50
                    transition
                  "
                >
                  <Bot className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="max-h-[350px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="text-xs text-slate-500 border-b">
                      <th className="p-3 px-8 w-40">學生 ID</th>
                      <th className="p-3 w-40">未精熟指標數</th>
                      <th className="p-3 w-60">風險比例</th>
                      <th className="p-3 w-40 text-center">狀態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {studentRiskRanking.map((student) => (
                      <tr key={student.userId} className="hover:bg-slate-50 transition group">
                        <td className="px-8 py-3 text-sm">{student.userId}</td>
                        <td className="px-4 py-3">
                          {/* 滑鼠移動顯示名稱 */}
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-rose-600 font-bold border-b border-rose-200 cursor-help">
                                  {student.unmasteredCount}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="bg-rose-100 shadow-2xl border-rose-300 text-slate-800">
                                <p className="text-sm font-bold mb-1">待加強指標：</p>
                                <p className="text-[11px] leading-relaxed whitespace-pre-line max-w-[200px]">
                                  {student.unmasteredNames || "無"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[80px]">
                              <div className="bg-rose-500 h-2 rounded-full transition-all duration-500" style={{ width: `${student.riskScore}%` }} />
                            </div>
                              <span className="text-xs font-medium text-slate-500 w-10">
                              {student.riskScore.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 p-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${student.riskScore > 70 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                            {student.riskScore > 70 ? "高度風險" : "中度觀察"}
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

