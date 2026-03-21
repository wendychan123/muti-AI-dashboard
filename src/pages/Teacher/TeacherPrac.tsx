import { useEffect, useMemo, useState, useRef } from "react";
import { useUserContext } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import dayjs from "dayjs";
import Plot from "react-plotly.js";
import _ from "lodash";
import { buildTeacherPracPrompt } from "@/lib/ai/buildTeacherPracPrompt";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Filter, Bot, HelpCircle, Activity, Users, Target, ActivitySquare, AlertOctagon } from "lucide-react";

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
  organization_id: string;
  grade: number;
  subject_name: string;
  indicator: string;
  indicate_name: string;
  student_count: number;
  mastered_student_count: number;
  student_mastery_rate_pct: number;
  total_prac_count: number;
  total_time_sec: number;
  avg_prac_per_student: number;
  avg_time_per_student_sec: number;
  avg_time_per_prac_sec: number;
  end_date: string;
  days_since_last_prac: number;
}

interface SubjectSummary {
  city: string;
  organization_id: string;
  grade: number;
  subject_name: string;
  grade_total_students: number;
  student_count: number;
  mastered_student_count: number;
  participation_rate_pct: number;
  student_mastery_rate_pct: number;
  total_prac_count: number;
  total_time_sec: number;
  avg_prac_per_student: number;
  avg_time_per_student_sec: number;
}

interface StudentAlert {
  organization_id: string;
  grade: number;
  user_id: string;
  subject_name: string;
  indicator: string;
  indicate_name: string;
  last_score: number;
  school_avg_score: number;
  score_gap: number;
  mastery_status: string;
}

interface SchoolSummary {
  organization_id: string;
  grade: number;
  total_students: number; 
  avg_score_rate: number;
  total_prac_count: number;
}

type TeacherPracChartTarget = 
  | "teacher_overview"
  | "diagnostic"
  | "participation"
  | "practice_trend"
  | "performance_trend"
  | "indicator_treemap"
  | "student_risk";

const ALL_GRADE = "全部年級";
const ALL_SUBJECT = "全部科目";

const uniqSorted = (arr: (string | number | null | undefined)[]) =>
  Array.from(new Set(arr.filter((v) => v !== null && v !== undefined)))
    .map((v) => String(v))
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));

/* =========================
     Main Component
========================= */
export default function TeacherPrac() {
  const { userInfo } = useUserContext();
  const organizationId = userInfo?.organization_id;

  const [pracData, setPracData] = useState<SchoolPracDaily[]>([]);
  const [schoolSummary, setSchoolSummary] = useState<SchoolSummary[]>([]);
  const [indicatorSummary, setIndicatorSummary] = useState<IndicatorSummary[]>([]);
  const [subjectSummary, setSubjectSummary] = useState<SubjectSummary[]>([]);
  const [alertData, setAlertData] = useState<StudentAlert[]>([]);

  const [selectedGrade, setSelectedGrade] = useState(ALL_GRADE);
  const [selectedSubject, setSelectedSubject] = useState(ALL_SUBJECT);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [geminiLoading, setGeminiLoading] = useState(false);

  const riskCardRef = useRef<HTMLDivElement>(null); 

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
        const { data: prac } = await supabase.from("school_prac_daily").select("*").eq("organization_id", organizationId);
        const { data: indicator } = await supabase.from("school_indicator_summary").select("*").eq("organization_id", organizationId);
        const { data: subject } = await supabase.from("school_subject_summary").select("*").eq("city", userInfo.city);
        const { data: alert } = await supabase.from("school_indicator_alert").select("*").eq("organization_id", organizationId);
        const { data: summary } = await supabase.from("school_summary").select("*").eq("city", userInfo.city);
        
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

  const gradeOptions = useMemo(() => uniqSorted(pracData.map((r) => r.grade)), [pracData]);
  const subjectOptions = useMemo(() => {
    let rows = pracData;
    if (selectedGrade !== ALL_GRADE) rows = rows.filter((r) => r.grade === Number(selectedGrade));
    return uniqSorted(rows.map((r) => r.subject_name));
  }, [pracData, selectedGrade]);

  const periodLabel = useMemo(() => {
    if (filteredPrac.length === 0) return "資料期間：無數據";
    const dates = filteredPrac.map(d => d.activity_date).sort();
    const s = dayjs(dates[0]).format("YYYY/MM/DD");
    const e = dayjs(dates[dates.length - 1]).format("YYYY/MM/DD");
    const days = dayjs(dates[dates.length - 1]).diff(dayjs(dates[0]), "day") + 1;
    return `資料期間：${s} ～ ${e}（${days} 天）`;
  }, [filteredPrac]);

  const scrollToRiskTable = () => {
    riskCardRef.current?.scrollIntoView({ behavior: 'smooth', block: "center" });
  };

  /* =========================
      高風險學生名單
  ========================= */
  /* =========================
      高風險學生名單 (修正版：新增練習指標統計)
  ========================= */
  const studentRiskRanking = useMemo(() => {
    if (!filteredAlert || filteredAlert.length === 0) return [];

    // userMap 結構調整：新增 allNames 紀錄所有練習過的單元
    const userMap = new Map<string, { unmastered: number; total: number; unmasteredNames: string[], allNames: string[] }>();

    filteredAlert.forEach((a) => {
      const uId = a.user_id ? String(a.user_id) : null;
      if (!uId) return;

      if (!userMap.has(uId)) {
        userMap.set(uId, { unmastered: 0, total: 0, unmasteredNames: [], allNames: [] });
      }
      const u = userMap.get(uId)!;
      u.total += 1;
      
      // 紀錄所有練習過的指標名稱
      u.allNames.push(a.indicate_name || a.indicator);
      
      let score = parseFloat(String(a.last_score));
      if (score <= 1.0 && score > 0) score *= 100;

      if (!isNaN(score) && score < 99.99) {
        u.unmastered += 1;
        u.unmasteredNames.push(`${a.indicate_name || a.indicator} (${score.toFixed(0)}分)`);
      }
    });

    const list = Array.from(userMap.entries()).map(([userId, stats]) => ({
      userId,
     
      riskScore: stats.total > 0 ? (stats.unmastered / stats.total) * 100 : 0,
      unmasteredCount: stats.unmastered,
      totalCount: stats.total, // 練習指標數
      unmasteredNames: stats.unmasteredNames.length > 0 ? stats.unmasteredNames.map(name => `- ${name}`).join("\n") : "無",
      allNames: stats.allNames.length > 0 ? stats.allNames.map(name => `- ${name}`).join("\n") : "無"
    }));

    return list
      .filter(s => s.unmasteredCount > 0)
      .sort((a, b) => b.unmasteredCount - a.unmasteredCount);
  }, [filteredAlert]);

  /* =========================
      KPI 
  ========================= */
  const kpi = useMemo(() => {
    const totalStudents = _.sumBy(filteredSubjectSummary, "student_count");

    let totalSchoolStudents = 0;
    const currentSchoolRows = schoolSummary.filter(s => String(s.organization_id) === String(organizationId));
    if (selectedGrade === ALL_GRADE) totalSchoolStudents = _.sumBy(currentSchoolRows, "total_students");
    else totalSchoolStudents = currentSchoolRows.find(s => String(s.grade) === String(selectedGrade))?.total_students || 0;
    const participationRate = totalSchoolStudents > 0 ? (totalStudents / totalSchoolStudents) * 100 : 0;

    const totalMastered = _.sumBy(filteredSubjectSummary, "mastered_student_count");
    const masteryRate = totalStudents > 0 ? (totalMastered / totalStudents) * 100 : 0;

    const totalTimePrac = _.sumBy(filteredSubjectSummary, "total_time_sec");
    const TimePracPerStudent = totalStudents > 0 ? (totalTimePrac / totalStudents) : 0;
    const totalPrac = _.sumBy(filteredSubjectSummary, "total_prac_count");
    const avgPracPerStudent = totalStudents > 0 ? (totalPrac / totalStudents) : 0;

    const notMasteredStudents = studentRiskRanking.length;

    const uniqueSchools = _.uniqBy(subjectSummary, "organization_id");
    const hasMultipleSchools = uniqueSchools.length > 1;
    const cityMatchedRows = subjectSummary.filter(s => {
        if (selectedGrade !== ALL_GRADE && s.grade !== Number(selectedGrade)) return false;
        if (selectedSubject !== ALL_SUBJECT && s.subject_name !== selectedSubject) return false;
        return true;
    });
    const cityTotalMastered = _.sumBy(cityMatchedRows, "mastered_student_count");
    const cityTotalPracticers = _.sumBy(cityMatchedRows, "student_count");
    const cityOverallMasteryRate = cityTotalPracticers > 0 ? (cityTotalMastered / cityTotalPracticers) * 100 : 0;

    return {
      totalStudents, totalSchoolStudents, participationRate, masteryRate,
      cityOverallMasteryRate, hasMultipleSchools, totalTimePrac, TimePracPerStudent, avgPracPerStudent, 
      notMasteredStudents
    };
  }, [filteredSubjectSummary, schoolSummary, subjectSummary, studentRiskRanking, selectedGrade, selectedSubject, organizationId]);

  /* =========================
      圖表資料處理
  ========================= */
  // 教學診斷四象限 
  const quadrantData = useMemo(() => {
    const rows = filteredIndicator.map(r => ({
      name: r.indicate_name,
      avgCount: r.student_count > 0 ? (r.total_prac_count / r.student_count) : 0, 
      avgScore: r.student_mastery_rate_pct ?? 0 
    }));

    const xValues = rows.map(r => r.avgCount);
    const sortedX = [...xValues].sort((a, b) => a - b);
    const xAvg = sortedX.length > 0 ? sortedX[Math.floor(sortedX.length / 2)] : 5;
    const yAvg = 60; 

    return {
      rows, xAvg, yAvg, xMax: Math.max(...xValues, 10)
    };
  }, [filteredIndicator]);

  // 作答參與度
  const participationData = useMemo(() => {
    const data = filteredIndicator
      .map((r) => {
        const gradeTotal = schoolSummary.find(s => s.grade === r.grade)?.total_students || 1;
        const calcRate = (r.student_count / gradeTotal) * 100;
        return {
          name: r.indicator,
          fullName: r.indicate_name,
          rate: calcRate,
          students: r.student_count ?? 0,
        };
      })
      .sort((a, b) => b.rate - a.rate);

    const dynamicHeight = Math.max(260, data.length * 40); 
    return { data, dynamicHeight };
  }, [filteredIndicator, schoolSummary]);

  // 練習趨勢與成效走勢
  const aggregatedPracTrend = useMemo(() => {
    const map = new Map<string, { active_students: number; total_prac: number }>();
    filteredPrac.forEach((r) => {
      const dateObj = dayjs(r.activity_date);
      const key = viewMode === "day" ? dateObj.format("YYYY-MM-DD") : viewMode === "week" ? dateObj.startOf("week").format("YYYY-MM-DD") : dateObj.startOf("month").format("YYYY-MM-DD");
      if (!map.has(key)) map.set(key, { active_students: 0, total_prac: 0 });
      const entry = map.get(key)!;
      entry.active_students += r.student_count || 0;
      entry.total_prac += r.total_prac_count || 0;
    });
    return Array.from(map.entries())
      .map(([date, val]) => ({ date, active_students: val.active_students, total_prac_count: val.total_prac }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredPrac, viewMode]);

  const aggregatedScoreTrend = useMemo(() => {
    const map = new Map<string, { scoreSum: number; weight: number }>();
    filteredPrac.forEach((r) => {
      const dateObj = dayjs(r.activity_date);
      const key = viewMode === "day" ? dateObj.format("YYYY-MM-DD") : viewMode === "week" ? dateObj.startOf("week").format("YYYY-MM-DD") : dateObj.startOf("month").format("YYYY-MM-DD");
      if (!map.has(key)) map.set(key, { scoreSum: 0, weight: 0 });
      const entry = map.get(key)!;
      entry.scoreSum += r.avg_score_rate * r.total_prac_count;
      entry.weight += r.total_prac_count;
    });
    return Array.from(map.entries())
      .map(([date, v]) => ({ date, avgScore: v.weight > 0 ? v.scoreSum / v.weight : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredPrac, viewMode]);

  /* =========================
      能力指標熱力圖+預警分析
  ========================= */
  
  // 1. Treemap (能力指標熱力圖)
  const treemapData = useMemo(() => {
    const validIndicators = filteredIndicator.filter(r => r.student_count > 0);
    if (validIndicators.length === 0) return null;

    const rootName = selectedSubject !== ALL_SUBJECT ? selectedSubject : "所有科目";
    
    const labels = [rootName];
    const parents = [""];
    const values = [0]; 
    const colors = [0]; 
    const customData: string[][] = [["", "", ""]];

    validIndicators.forEach(r => {
      const shortName = r.indicator; 
      const fullName = r.indicate_name || r.indicator;
      
      labels.push(shortName);
      parents.push(rootName);
      values.push(r.student_count); // 大小：練習人數
      
      const masteryRate = r.student_mastery_rate_pct || 0;
      colors.push(masteryRate); // 顏色：精熟率

      customData.push([fullName, String(r.student_count), masteryRate.toFixed(1)]);
    });

    return { labels, parents, values, colors, customData, rootName };
  }, [filteredIndicator, selectedSubject]);

  // 2. 教學洞察：時序衰退 與 無效練習
  const teachingInsights = useMemo(() => {
    // 衰退預警：精熟率超過 80%，但已經超過 14 天沒有練習的指標 (即將遺忘)
    const decayWarnings = filteredIndicator.filter(r => 
      (r.student_mastery_rate_pct >= 80) && 
      (r.days_since_last_prac >= 14)
    ).sort((a, b) => b.days_since_last_prac - a.days_since_last_prac);

    // 無效練習：平均每題作答時間超過 120 秒，且精熟率低於 60% (可能題目太難、敘述太長、或學生亂猜)
    const ineffectiveWarnings = filteredIndicator.filter(r => 
      (r.avg_time_per_prac_sec > 120) && 
      (r.student_mastery_rate_pct < 60)
    ).sort((a, b) => b.avg_time_per_prac_sec - a.avg_time_per_prac_sec);

    return { decayWarnings, ineffectiveWarnings };
  }, [filteredIndicator]);

  /* =========================
      AI 助手功能
  ========================= */
  const TEACHER_CHART_LABELS: Record<TeacherPracChartTarget, string> = {
    teacher_overview: "總覽練習表現",
    diagnostic: "教學診斷指標",
    participation: "作答參與度",
    practice_trend: "練習投入走勢",
    performance_trend: "學習成效走勢",
    indicator_treemap: "能力指標熱力圖",
    student_risk: "高風險學生與弱點指標",
  };

  const runTeacherAIForChart = async (target: TeacherPracChartTarget | "teacher_overview") => {
    setGeminiLoading(true);
    const chartLabel = TEACHER_CHART_LABELS[target] || "全校練習表現";

    const prompt = buildTeacherPracPrompt({
      city: String(userInfo?.city || ""), 
      organization_id: String(organizationId || ""),
      grade: selectedGrade,
      subject: selectedSubject,
      period: periodLabel,
      stats: {
        totalStudents: kpi.totalStudents,
        avgScore: kpi.masteryRate, 
        avgPracPerStudent: kpi.avgPracPerStudent,
        notMasteredStudents: kpi.notMasteredStudents,
        notMasteredIndicators: 0, 
      },
      selectedCharts: [target as any],
    });

    window.dispatchEvent(new CustomEvent("teacher-ai-update", { detail: { loading: true, questions: [chartLabel] } }));

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, role: "teacher_diagnostic" }),
      });
      const data = await res.json();
      window.dispatchEvent(new CustomEvent("teacher-ai-update", { detail: { loading: false, content: data.text } }));
    } catch (err) {
      console.error("Teacher AI error:", err);
      window.dispatchEvent(new CustomEvent("teacher-ai-update", { detail: { loading: false, content: "AI 診斷暫時無法連線，請稍後再試。" } }));
    } finally {
      setGeminiLoading(false);
    }
  };

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<{ charts: string[] }>).detail;
      if (!detail || !detail.charts?.length || !kpi) return; 

      const selected: TeacherPracChartTarget[] = detail.charts.filter((c): c is TeacherPracChartTarget => c in TEACHER_CHART_LABELS);
      if (selected.length === 0) return;

      setGeminiLoading(true);
      const chartLabels = selected.map((c) => TEACHER_CHART_LABELS[c]);
      const prompt = buildTeacherPracPrompt({
        city: String(userInfo?.city || ""), 
        organization_id: String(organizationId || ""),
        grade: selectedGrade,        
        subject: selectedSubject,
        period: periodLabel,
        selectedCharts: selected, 
        stats: {
          totalStudents: kpi.totalStudents,
          avgScore: kpi.masteryRate,
          avgPracPerStudent: kpi.avgPracPerStudent,
          notMasteredStudents: kpi.notMasteredStudents,   
          notMasteredIndicators: 0 
        },
      });

      window.dispatchEvent(new CustomEvent("teacher-ai-update", { detail: { loading: true, questions: chartLabels } }));

      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, role: "teacher_diagnostic" }),
        });
        const data = await res.json();
        window.dispatchEvent(new CustomEvent("teacher-ai-update", { detail: { loading: false, content: data.text } }));
      } catch (err) {
        window.dispatchEvent(new CustomEvent("teacher-ai-update", { detail: { loading: false, content: "AI 整合分析失敗，請檢查網路連線或稍後再試。" } }));
      } finally {
        setGeminiLoading(false);
      }
    };
    window.addEventListener("teacher-ai-multi-request", handler);
    return () => window.removeEventListener("teacher-ai-multi-request", handler);
  }, [selectedGrade, selectedSubject, periodLabel, kpi, organizationId, userInfo?.city]);

  /* =========================
     工具函數
  ========================= */
  const wrapText = (str: string, len = 20) => {
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
    <div className="min-h-screen p-4 space-y-6 bg-slate-50">
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
                <span className="animate-spin"><Activity className="w-4 h-4"/></span>
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
  =========================  */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* KPI 1: 學生母數 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            參與練習人數
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-3xl font-black text-slate-800 tracking-tight">
              {kpi.totalStudents.toLocaleString()}
            </div>
            <div className="text-[11px] text-center text-slate-400 ">總學生數{kpi.totalSchoolStudents.toLocaleString()}人<br/>(參與率{kpi.participationRate.toFixed(1)}%)</div>
          </div>
        </div>

        {/* KPI 2: 整體精熟率 (更新為精熟率) */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            平均答題正確率
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <div className="text-3xl font-black tracking-tight text-slate-800">
               {kpi.masteryRate.toFixed(1)}%
            </div>
            
            <div className="mt-1 flex flex-col items-center">
              {kpi.hasMultipleSchools ? (
                <>
                  <span className="text-[11px] text-slate-400">
                    全市平均 {kpi.cityOverallMasteryRate.toFixed(1)}%
                  </span>
                  {kpi.masteryRate >= kpi.cityOverallMasteryRate ? (
                    <span className="text-[11px] text-emerald-600 font-bold">
                      （↑ {(kpi.masteryRate - kpi.cityOverallMasteryRate).toFixed(1)}%）
                    </span>
                  ) : (
                    <span className="text-[11px] text-rose-500 font-bold">
                      （↓ {(kpi.cityOverallMasteryRate - kpi.masteryRate).toFixed(1)}%）
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
            練習投入時間
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-3xl font-black text-slate-800 tracking-tight text-emerald-600">
               {(kpi.totalTimePrac).toFixed(0)} <span className="text-lg">秒</span>
            </div>
            <div className="text-[11px] text-center text-slate-400 mt-1">人均練習 {kpi.avgPracPerStudent.toFixed(1)} 次</div>
          </div>
        </div>

        

        {/* KPI 4: 未精熟人數 (可過濾) */}
       <div 
          onClick={scrollToRiskTable}
          className="flex flex-col bg-white border border-slate-200 rounded-md overflow-hidden shadow-sm cursor-pointer hover:shadow-md hover:border-rose-300 transition-all active:scale-[0.98] group"
        >
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            需關注未精熟人數
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-5">
            <div className={`text-4xl font-black tracking-tight ${kpi.notMasteredStudents > 0 ? "text-rose-600" : "text-slate-300"}`}>
              {kpi.notMasteredStudents} <span className="text-lg font-bold text-rose-400/70">人</span>
            </div>
            <div className="text-[11px] text-rose-300 mt-2 font-medium px-2 py-1 rounded-full group-hover:text-rose-500 transition-colors">
              點擊查看名單 ↓
            </div>
          </div>
        </div>

      </div>

      {/* =========================
            圖表區
  =========================  */}

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                            <b className="text-violet-600">活躍教育關係人數 (長條圖)：</b>
                            指該日/週/月內有實際進行作答的教育關係人數
                          </li>
                          <li>
                            <b className="text-violet-600">練習總次數 (折線圖)：</b>
                            完成練習題的累計總量。
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
                  ${viewMode === mode ? "bg-violet-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
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
                  name: "總練習人數",
                  marker: { color: "rgba(139, 92, 246, 0.3)" },
                  hovertemplate: "活躍教育關係人數：%{y}人<extra></extra>",
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
                yaxis: { title: "總練習人數", side: "left", showgrid: true, zeroline: true},
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
                            <b className="text-slate-700 font-bold">平均：</b>
                            顯示目前在特定單元下的平均正確率走勢，反映整體的理解程度。
                          </li>
                          <li>
                            <b className="text-slate-600 font-bold">總平均：</b>
                            作為基準線以判斷表現優於或低於整體該科平均。
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

          <div className="flex items-center gap-1 mr-2 px-8">
            {["day", "week", "month"].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`px-3 py-1 text-xs rounded-md transition
                  ${viewMode === mode ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {mode === "day" ? "日線" : mode === "week" ? "週線" : "月線"}
              </button>
            ))}
          </div>
          
          <CardContent className="h-[350px] w-full">
            <Plot
              data={[
                {
                  x: aggregatedScoreTrend.map((d) => d.date),
                  y: aggregatedScoreTrend.map((d) => d.avgScore),
                  type: "scatter",
                  mode: "lines+markers",
                  name: "當前期間平均",
                  line: { color: "#7c3aed", width: 3, shape: 'spline' }, 
                  hovertemplate: "答對率：%{y:.1f}%<extra></extra>",
                }
              ]}
              layout={{
                autosize: true,
                margin: { t: 30, l: 50, r: 30, b: 80 },
                xaxis: {
                  title: viewMode === "day" ? "日期" : viewMode === "week" ? "週起始日" : "月份",
                  type: "category", tickangle: -45, tickfont: { size: 10, color: "#64748b" },
                },
                yaxis: {
                  title: "平均答對率 (%)", range: [0, 105], ticksuffix: "%", gridcolor: "#f1f5f9",
                },
                legend: { orientation: "h", y: -0.3 },
                hovermode: "x unified",
              }}
              style={{ width: "100%", height: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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
                              代表教育關係人透過頻繁練習且維持高正確率。此指標掌握度極佳，建議可進入下一階段學習。
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1" />
                            <span>
                              <b className="text-emerald-700">潛力區 (低次數、高得分)：</b>
                              代表教育關係人練習次數不多即獲得高分。可能是指標難度較低，或是教育關係人已具備深厚的先備知識。
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1" />
                            <span>
                              <b className="text-amber-700">低參與 (低次數、低得分)：</b>
                              代表實質練習量不足。應優先引導教育關係人進行基本作答，累積足夠的互動數據以利後續診斷。
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-rose-500 mt-1" />
                            <span>
                              <b className="text-rose-700">瓶頸區 (高次數、低得分)：</b>
                              代表教育關係人嘗試多次練習但成效不佳。此為核心學習障礙，需優先介入輔導。
                            </span>
                          </li>
                        </ul>
                        <p className="text-[12px] text-slate-400 pt-1 border-t leading-relaxed">
                          ※ 以人均練習次數作為 X 軸，排除無效掛機時間，反映該校學生與學習內容的互動頻率與成效。
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
                        ? (r.avgCount >= quadrantData.xAvg ? "rgba(37, 100, 235, 0.8)" : "rgba(22, 163, 74, 0.8)") 
                        : (r.avgCount >= quadrantData.xAvg ? "rgba(220, 38, 38, 0.8)" : "rgba(154, 154, 154, 1)") 
                    ),
                    opacity: 0.6,
                    line: { color: 'white', width: 1 }
                  },
                  text: quadrantData.rows.map(r => wrapText(r.name, 20)),
                  hovertemplate: 
                    "<b>能力指標：%{text}</b><br>" +
                    "實質參與：%{x:.1f} 次練習<br>" + 
                    "精熟率：%{y:.1f}%<br>" +
                    "<extra></extra>",
                  hoverlabel: { align: "left", namelength: -1 }
                }
              ]}
              layout={{
                height: 260,
                margin: { t: 30, r: 30, b: 60, l: 60 },
                xaxis: { 
                  title: { text: "人均練習次數", font: { size: 12, color: '#64748b' }, standoff: 15 },                                 
                  gridcolor: '#f1f5f9', zeroline: false 
                },
                yaxis: { 
                  title: { text: "學生精熟率 (%)", font: { size: 12, color: '#64748b' }, standoff: 15 },
                  range: [-5, 110], gridcolor: '#f1f5f9', zeroline: false 
                },
                shapes: [
                  { type: "line", x0: quadrantData.xAvg, x1: quadrantData.xAvg, y0: 0, y1: 100, line: { color: "#94a3b8", dash: "dot", width: 2 } },
                  { type: "line", x0: 0, x1: quadrantData.xMax * 1.1, y0: quadrantData.yAvg, y1: quadrantData.yAvg, line: { color: "#94a3b8", dash: "dot", width: 2 } },
                ],
                annotations: [
                  { x: quadrantData.xMax, y: 105, text: "<b>精熟區</b>", showarrow: false, xanchor: 'right', font: { color: "#2563eb" } },
                  { x: 0, y: 105, text: "<b>潛力區</b>", showarrow: false, xanchor: 'left', font: { color: "#16a34a" } },
                  { x: 0, y: 5, text: "<b>低參與</b>", showarrow: false, xanchor: 'left', font: { color: "#727272ff" } },
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
                    hoverlabel: { align: "left", namelength: -1, bgcolor: "#fff", bordercolor: "#e2e8f0", font: { size: 12, color: "#1e293b" } }
                  },
                  {
                    x: participationData.data.map((d) => d.students),
                    y: participationData.data.map((d) => d.name),
                    type: "scatter",
                    mode: "lines+markers",
                    name: "參與人數",
                    xaxis: "x2", 
                    line: { color: "rgb(76 29 149)", width: 2 },
                    marker: { size: 6 },
                    hovertemplate: "實際人數：%{x} 人<extra></extra>",
                  },
                ]}
                layout={{
                  autosize: true,
                  height: participationData.dynamicHeight,
                  margin: { l: 120, r: 30, t: 35, b: 60 },
                  showlegend: false,
                  xaxis: {
                    title: { text: "參與率 (%)", font: { size: 12, color: '#64748b' }, standoff: 15 },
                    range: [0, 105], side: "bottom", tickfont: { size: 10 }, gridcolor: "#f1f5f9", zeroline: false
                  },
                  xaxis2: {
                    title: { text: "實際作答人數 (人)", font: { size: 12, color: "rgb(76 29 149)" }, standoff: 15 },
                    overlaying: "x", side: "top", showgrid: false, zeroline: false, tickfont: { size: 10, color: "rgb(76 29 149)" },
                  },
                  yaxis: {
                    title: { text: "能力指標", font: { size: 12, color: '#64748b' }, standoff: 10 },
                    automargin: true, tickfont: { size: 10, color: "#64748b" },
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


      {/* =========================
          能力指標熱力圖
      ========================= */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        
        {/* 左側：Treemap 熱力圖 (佔 2 欄) */}
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
              能力指標熱力圖
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
                            <b className="text-slate-700 font-bold">區塊大小：</b>
                            代表該指標的參與練習人數。越大的方塊代表該單元學生練習較集中，或為近期教學重點。
                          </li>
                          <li>
                            <b className="text-slate-700 font-bold">區塊顏色：</b>
                            代表平均精熟率。<span className="text-violet-200 font-bold">顏色偏白</span>表示精熟率低（需優先關注），<span className="text-violet-600 font-bold">顏色深紫</span>表示精熟率高（已達標）。
                          </li>
                        </ul>
                        <p className="text-[11px] text-slate-500 pt-1 border-t italic">
                          ※ 提示：請特別注意<b className="text-violet-600">「面積大但顏色偏白」</b>的區塊，這通常是全校共同的學習瓶頸。
                        </p>                      
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* AI 分析按鈕 */}
              <button
                onClick={() => runTeacherAIForChart("indicator_treemap")}
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

          <CardContent className="h-[380px] w-full">
            {treemapData ? (
              <Plot
                data={[{
                  type: "treemap",
                  labels: treemapData.labels,
                  parents: treemapData.parents,
                  values: treemapData.values,
                  marker: {
                    colors: treemapData.colors,
                    colorscale: [
                      [0, '#f7f7f7ff'],       // 0%: 純白底色
                      [0.4, '#ddd6fe'],     // 40%: 極淺紫 (Tailwind purple-200)
                      [0.7, '#a78bfa'],     // 70%: 淺紫 (Tailwind purple-400)
                      [1, '#621bddff']        // 100%: 教師主色 (Tailwind purple-600)
                    ],
                    cmin: 0, 
                    cmax: 100, 
                    showscale: true,
                    line: { color: '#ffffffff', width: 1 },
                    colorbar: { 
                      title: '精熟率(%)', 
                      titleside: 'right', 
                      tickfont: { size: 10 },
                      outlinewidth: 0, 
                    }
                  },
                  customdata: treemapData.customData,
                  textinfo: "label+value",
                  textfont: { size: 12, weight: "bold" },
                  hovertemplate: 
                    "<b>%{customdata[0]}</b><br>參與人數：%{customdata[1]} 人<br>精熟率：%{customdata[2]}%<br><extra></extra>",
                  hoverlabel: { align: "left", namelength: -1 }
                }]}
                layout={{ 
                  autosize: true, 
                  margin: { t: 0, l: 0, r: 0, b: 0 }, 
                  paper_bgcolor: '#ffffff', 
                  plot_bgcolor: '#ffffff' 
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">無指標數據</div>
            )}
          </CardContent>

          {/* 教學洞察預警 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
            
            {/* 預警安排練習 */}
            <Card className="flex-1 border-gray-200 shadow-sm rounded-xl overflow-hidden">
              <div className="bg-gray-100 text-gray-800 text-sm font-bold py-2.5 px-4 flex items-center gap-2 border-b border-gray-200">
                預警安排練習
              </div>
              <div className="p-3 overflow-y-auto max-h-[180px] scrollbar-thin scrollbar-thumb-gray-200">
                <p className="text-xs text-slate-500 mb-2">精熟率高，但已超過 14 天未練習，建議安排練習活動</p>
                {teachingInsights.decayWarnings.length > 0 ? (
                  <ul className="space-y-2">
                    {teachingInsights.decayWarnings.map(r => (
                      <li key={r.indicator} className="text-xs flex justify-between items-center bg-white p-2 rounded border border-violet-300 shadow-sm">
                        <span className="font-medium text-slate-700 truncate w-4/5" title={r.indicate_name}>{r.indicate_name || r.indicator}</span>
                        <span className="text-violet-600 font-bold text-[10px]">{r.days_since_last_prac} 天前</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-400 text-center py-4">目前無需多加安排練習單元</div>
                )}
              </div>
            </Card>

            {/* 無效練習預警 */}
            <Card className="flex-1 border-gray-200 shadow-sm rounded-xl overflow-hidden">
              <div className="bg-gray-100 text-gray-800 text-sm font-bold py-2.5 px-4 flex items-center gap-2 border-b border-gray-200">
              學習瓶頸或無效練習
              </div>
              <div className="p-3 overflow-y-auto max-h-[140px] scrollbar-thin scrollbar-thumb-rose-200">
                <p className="text-xs text-slate-500 mb-2">單題作答時間極長且精熟率低，可能是題目過難或學生卡關</p>
                {teachingInsights.ineffectiveWarnings.length > 0 ? (
                  <ul className="space-y-2">
                    {teachingInsights.ineffectiveWarnings.map(r => (
                      <li key={r.indicator} className="text-xs flex flex-col gap-1 bg-white p-2 rounded border border-violet-300 shadow-sm">
                        <span className="font-medium text-slate-700 truncate w-full" title={r.indicate_name}>{r.indicate_name || r.indicator}</span>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">耗時：<span className="text-violet-500 font-bold">{r.avg_time_per_prac_sec}秒/題</span></span>
                          <span className="text-slate-400">精熟：<span className="text-violet-500 font-bold">{r.student_mastery_rate_pct}%</span></span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-400 text-center py-4">目前無無效練習單元</div>
                )}
              </div>
            </Card>
          </div>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* 待關注教育關係人名單 */}
          <Card className="col-span-1 relative overflow-hidden border-slate-200 shadow-sm"  ref={riskCardRef}>
            {loading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Activity className="animate-spin mr-2 w-4 h-4" />
                <span className="text-sm text-slate-600">資料分析中...</span>
              </div>
            )}
          
          <CardHeader className="flex flex-row items-center justify-between py-4 pb-2">
            <CardTitle className="text-xl font-bold text-slate-800">
              高風險學生與弱點指標 <span className="px-2 text-xs text-violet-600">（ 科目：{selectedSubject} ）</span>
              
            </CardTitle>
              
              <div className="flex items-center gap-1">
               {/* Tooltip 說明保留不變 */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-slate-400 hover:text-slate-600"><HelpCircle className="w-5 h-5" /></button>
                  </TooltipTrigger>                 
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#faf9fb] shadow-2xl border-violet-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-violet-700"> 表格說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li>
                          <b className="text-slate-700 font-bold">未精熟指標數：</b>
                          指該生在特定單元中，最後一次作答正確率<span className="text-rose-600 font-bold">未達滿分(100分)</span> 的單元總數。
                        </li>
                        <li>
                          <b className="text-slate-700 font-bold">練習指標數：</b>
                          指該生在該科目下<span className="text-violet-600 font-bold">實際參與過</span>的單元總量，反映學生在平台上的活動量。
                        </li>
                        <li>
                          <b className="text-slate-700 font-bold">狀態評估：</b>
                          系統自動計算未精熟單元佔其總練習量的比例，超過 70% 標註為「高度風險」，建議優先啟動輔導教學。
                        </li>                       
                        </ul> 
                        <p className="text-[11px] text-slate-400 pt-1 border-t">
                        ※ 提示：將滑鼠移至數值上方，可查看具體的單元名稱清單。
                      </p>                      
                      </div>
                    </TooltipContent> 
                </Tooltip>
              </TooltipProvider>

                <button onClick={() => runTeacherAIForChart("student_risk")} className="flex items-center justify-center w-8 h-8 rounded-full text-violet-500 hover:bg-violet-50 transition">
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
                    <th className="p-3 w-40">練習指標數</th>
                    <th className="p-3 w-40">未精熟指標數</th> 
                    <th className="p-3 w-40 text-center">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {studentRiskRanking.length > 0 ? (
                    studentRiskRanking.map((student) => (
                      <tr key={student.userId} className="hover:bg-slate-50 transition group">
                        <td className="px-8 py-3 text-sm font-medium text-slate-700">{student.userId}</td>

                        {/* 練習指標數 (顯示所有練習過的單元) */}
                        <td className="px-4 py-3">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-slate-600 font-medium border-b border-slate-200 cursor-help">
                                  {student.totalCount}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="bg-slate-800 shadow-2xl border-slate-700 text-white">
                                <p className="text-sm font-bold mb-1 text-slate-200">已參與單元：</p>
                                <p className="text-[11px] leading-relaxed whitespace-pre-line max-w-[200px]">
                                  {student.allNames}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        
                        {/* 未精熟指標數 (顯示紅字與弱點單元) */}
                        <td className="px-4 py-3">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-rose-600 font-bold border-b border-rose-200 cursor-help">
                                  {student.unmasteredCount}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="bg-rose-50 shadow-2xl border-rose-200 text-slate-800">
                                <p className="text-sm font-bold mb-1">待加強指標：</p>
                                <p className="text-[11px] leading-relaxed whitespace-pre-line max-w-[200px]">
                                  {student.unmasteredNames}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>


                        <td className="px-4 p-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${student.riskScore > 70 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                            {student.riskScore > 70 ? "高度風險" : "中度觀察"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500 bg-slate-50/50">
                        目前無待關注之高風險名單，或尚無作答數據
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
          </Card>
      </div>
    </div>
  );
}