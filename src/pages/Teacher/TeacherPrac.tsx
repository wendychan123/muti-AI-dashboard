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
import { Filter, Bot, HelpCircle, Activity, Copy, Check } from "lucide-react";

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
  
  // 圖表互動狀態
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null); 
  
  const [alertData, setAlertData] = useState<StudentAlert[]>([]);
  const [selectedGrade, setSelectedGrade] = useState(ALL_GRADE);
  const [selectedSubject, setSelectedSubject] = useState(ALL_SUBJECT);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [geminiLoading, setGeminiLoading] = useState(false);

  const riskCardRef = useRef<HTMLDivElement>(null); 
  const [cityTrendData, setCityTrendData] = useState<{ activity_date: string; avg_score_rate: number }[]>([]);

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
     同步PolicyPrac的全市平均資料
  ========================= */
  useEffect(() => {
    if (!userInfo?.city) return;

    const loadCityTrend = async () => {
      const isAllSubject = selectedSubject === ALL_SUBJECT;
      const tableName = isAllSubject ? "city_trend_daily" : "city_subject_trend_daily";
      
      let q = supabase
        .from(tableName)
        .select("activity_date, avg_score_rate")
        .eq("city", userInfo.city)
        .gte("activity_date", "2023-09-01") 
        .lte("activity_date", "2023-12-30");
        
      if (!isAllSubject) {
         q = q.eq("subject_name", selectedSubject);
      }
      
      const { data } = await q;
      setCityTrendData(data ?? []);
    };

    loadCityTrend();
  }, [userInfo?.city, selectedSubject]);

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

  /* =========================
     ★ 時間過濾樞紐 (activePrac)
  ========================= */
  const activePrac = useMemo(() => {
    if (!selectedDate) return filteredPrac;
    
    return filteredPrac.filter((r) => {
      const d = dayjs(r.activity_date);
      const key = viewMode === "day" 
        ? d.format("YYYY-MM-DD") 
        : viewMode === "week" 
          ? d.startOf("week").format("YYYY-MM-DD") 
          : d.startOf("month").format("YYYY-MM-DD");
      return key === selectedDate;
    });
  }, [filteredPrac, selectedDate, viewMode]);

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
   圖表連動篩選邏輯
  ========================= */
  const activeIndicatorSummary = useMemo(() => {
    if (!selectedIndicator) return filteredIndicator;
    return filteredIndicator.filter(r => r.indicator === selectedIndicator);
  }, [filteredIndicator, selectedIndicator]);

  /* =========================
      高風險學生名單 
  ========================= */
  const studentRiskRanking = useMemo(() => {
    const activeIndicatorIds = new Set(activePrac.map(p => p.indicator));

    const targetAlerts = filteredAlert.filter(a => {
      if (selectedIndicator && a.indicator !== selectedIndicator) return false;
      if (selectedDate && !activeIndicatorIds.has(a.indicator)) return false;
      return true;
    });

    if (!targetAlerts || targetAlerts.length === 0) return [];

    const userMap = new Map<string, { unmastered: number; total: number; unmasteredNames: string[], allNames: string[] }>();

    targetAlerts.forEach((a) => {
      const uId = a.user_id ? String(a.user_id) : null;
      if (!uId) return; 

      if (!userMap.has(uId)) {
        userMap.set(uId, { unmastered: 0, total: 0, unmasteredNames: [], allNames: [] });
      }
      const u = userMap.get(uId)!;
      u.total += 1;
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
      totalCount: stats.total,
      unmasteredNames: stats.unmasteredNames.length > 0 ? stats.unmasteredNames.map(name => `- ${name}`).join("\n") : "無",
      allNames: stats.allNames.length > 0 ? stats.allNames.map(name => `- ${name}`).join("\n") : "無"
    }));

    return list
      .filter(s => s.unmasteredCount > 0)
      .sort((a, b) => b.unmasteredCount - a.unmasteredCount);
      
  }, [filteredAlert, activePrac, selectedIndicator, selectedDate]);

  /* =========================
     KPI 
  ========================= */
  const kpi = useMemo(() => {
    let totalSchoolStudents = 0;
    const currentSchoolRows = schoolSummary.filter(s => String(s.organization_id) === String(organizationId));
    if (selectedGrade === ALL_GRADE) totalSchoolStudents = _.sumBy(currentSchoolRows, "total_students");
    else totalSchoolStudents = currentSchoolRows.find(s => String(s.grade) === String(selectedGrade))?.total_students || 0;

    const rawTotalStudents = _.sumBy(filteredSubjectSummary, "student_count");
    const totalStudents = totalSchoolStudents > 0 ? Math.min(rawTotalStudents, totalSchoolStudents) : rawTotalStudents;
    const participationRate = totalSchoolStudents > 0 ? (totalStudents / totalSchoolStudents) * 100 : 0;

    let totalScoreSum = 0;
    let totalPracWeight = 0;
    filteredPrac.forEach(r => {
      totalScoreSum += (r.avg_score_rate * r.total_prac_count);
      totalPracWeight += r.total_prac_count;
    });
    const masteryRate = totalPracWeight > 0 ? (totalScoreSum / totalPracWeight) : 0;

    const totalTimePrac = _.sumBy(filteredSubjectSummary, "total_time_sec");
    const TimePracPerStudent = totalSchoolStudents > 0 ? (totalTimePrac / totalSchoolStudents) : 0;
    
    const totalPrac = _.sumBy(filteredSubjectSummary, "total_prac_count");
    const avgPracPerStudent = totalSchoolStudents > 0 ? (totalPrac / totalSchoolStudents) : 0;

    const notMasteredStudents = studentRiskRanking.length;

    const cityOverallMasteryRate = cityTrendData.length > 0
      ? cityTrendData.reduce((sum, r) => sum + (r.avg_score_rate ?? 0), 0) / cityTrendData.length
      : 0;

    const uniqueSchools = _.uniqBy(subjectSummary, "organization_id");
    const hasMultipleSchools = uniqueSchools.length > 1;

    return {
      totalStudents, totalSchoolStudents, participationRate, masteryRate, 
      cityOverallMasteryRate, hasMultipleSchools, totalTimePrac, TimePracPerStudent, 
      avgPracPerStudent, notMasteredStudents
    };
  }, [filteredSubjectSummary, schoolSummary, subjectSummary, studentRiskRanking, selectedGrade, selectedSubject, organizationId, filteredPrac, cityTrendData]);

  /* =========================
      圖表資料處理：教學診斷四象限 
  ========================= */
  const quadrantData = useMemo(() => {
    let gradeTotalStudents = 0;
    const currentSchoolRows = schoolSummary.filter(s => String(s.organization_id) === String(organizationId));
    if (selectedGrade === ALL_GRADE) {
      gradeTotalStudents = _.sumBy(currentSchoolRows, "total_students");
    } else {
      gradeTotalStudents = currentSchoolRows.find(s => String(s.grade) === String(selectedGrade))?.total_students || 0;
    }
    gradeTotalStudents = gradeTotalStudents > 0 ? gradeTotalStudents : 1;

    const map = new Map<string, { name: string; totalScore: number; totalPrac: number; students: Set<string>; }>();

    activePrac.forEach(r => {
       if (!map.has(r.indicator)) {
          map.set(r.indicator, { name: r.indicate_name || r.indicator, totalScore: 0, totalPrac: 0, students: new Set() });
       }
       const obj = map.get(r.indicator)!;
       obj.totalScore += (r.avg_score_rate * r.total_prac_count);
       obj.totalPrac += r.total_prac_count;
       obj.students.add(String(r.user_id));
    });

    const rows = Array.from(map.entries()).map(([id, val]) => {
       let participationRate = (val.students.size / gradeTotalStudents) * 100;
       if (participationRate > 100) participationRate = 100;

       let avgScore = val.totalPrac > 0 ? (val.totalScore / val.totalPrac) : 0;
       if (avgScore <= 1.0 && avgScore > 0) avgScore *= 100; 

       return {
          id, name: val.name, xValue: participationRate, yValue: avgScore,
          studentCount: val.students.size, pracCount: val.totalPrac
       };
    });

    const xValues = rows.map(r => r.xValue);
    const sortedX = [...xValues].sort((a, b) => a - b);
    const medianX = sortedX.length > 0 ? sortedX[Math.floor(sortedX.length / 2)] : 50;
    const xAvg = Math.max(medianX, 5); 
    const maxX = Math.max(...xValues, 10); 
    const yAvg = kpi.masteryRate > 0 ? kpi.masteryRate : 60; 

    return { rows, xAvg, yAvg, maxX };
  }, [activePrac, schoolSummary, selectedGrade, organizationId, kpi.masteryRate]); 

  // 練習趨勢與成效走勢 (★ 修復：過濾重複使用者 ID，算真實活躍人數)
  const aggregatedPracTrend = useMemo(() => {
    const map = new Map<string, { students: Set<string>; total_prac: number }>();
    
    filteredPrac.forEach((r) => {
      const dateObj = dayjs(r.activity_date);
      const key = viewMode === "day" ? dateObj.format("YYYY-MM-DD") : viewMode === "week" ? dateObj.startOf("week").format("YYYY-MM-DD") : dateObj.startOf("month").format("YYYY-MM-DD");
      
      if (!map.has(key)) map.set(key, { students: new Set(), total_prac: 0 });
      
      const entry = map.get(key)!;
      entry.students.add(String(r.user_id)); // 使用 Set 過濾重複 ID
      entry.total_prac += r.total_prac_count || 0;
    });

    return Array.from(map.entries())
      .map(([date, val]) => ({ date, active_students: val.students.size, total_prac_count: val.total_prac }))
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
      知識節點熱力圖
  ========================= */
  const treemapData = useMemo(() => {
    const map = new Map<string, { name: string; students: Set<string>; scoreSum: number; pracCount: number }>();
    
    activePrac.forEach(r => {
       if (selectedIndicator && r.indicator !== selectedIndicator) return;
       
       if (!map.has(r.indicator)) map.set(r.indicator, { name: r.indicate_name || r.indicator, students: new Set(), scoreSum: 0, pracCount: 0 });
       const obj = map.get(r.indicator)!;
       obj.students.add(String(r.user_id));
       obj.scoreSum += (r.avg_score_rate * r.total_prac_count);
       obj.pracCount += r.total_prac_count;
    });

    if (map.size === 0) return null;

    const rootName = selectedSubject !== ALL_SUBJECT ? selectedSubject : "所有科目";
    const labels = [rootName];
    const parents = [""];
    const values = [0]; 
    const colors = [0]; 
    const customData: string[][] = [["", "", ""]];

    map.forEach((val, id) => {
       labels.push(id);
       parents.push(rootName);
       values.push(val.students.size); 
       let masteryRate = val.pracCount > 0 ? (val.scoreSum / val.pracCount) : 0;
       if (masteryRate <= 1.0 && masteryRate > 0) masteryRate *= 100;
       colors.push(masteryRate);
       customData.push([val.name, String(val.students.size), masteryRate.toFixed(1)]);
    });

    return { labels, parents, values, colors, customData, rootName };
  }, [activePrac, selectedIndicator, selectedSubject]);

  // 2. 教學洞察預警
  const teachingInsights = useMemo(() => {
    const decayWarnings = activeIndicatorSummary.filter(r => 
      (r.student_mastery_rate_pct >= 80) && 
      (r.days_since_last_prac >= 14)
    ).sort((a, b) => b.days_since_last_prac - a.days_since_last_prac);

    return { decayWarnings };
  }, [activeIndicatorSummary]); 

  /* =========================
      AI 助手功能
  ========================= */
  const TEACHER_CHART_LABELS: Record<TeacherPracChartTarget, string> = {
    teacher_overview: "總覽練習表現",
    diagnostic: "教學診斷指標",
    practice_trend: "練習時間走勢",
    performance_trend: "答對率走勢",
    indicator_treemap: "知識節點熱力圖",
    student_risk: "高風險學生與弱點知識節點",
  };

  const runTeacherAIForChart = async (target: TeacherPracChartTarget | "teacher_overview") => {
    setGeminiLoading(true);

    const currentIndicatorName = selectedIndicator ? (activeIndicatorSummary[0]?.indicate_name || selectedIndicator) : null;
    const currentAvgScore = selectedIndicator && activeIndicatorSummary.length > 0 ? activeIndicatorSummary[0].student_mastery_rate_pct : kpi.masteryRate;
    const chartLabel = TEACHER_CHART_LABELS[target] || "全校練習表現";

    const prompt = buildTeacherPracPrompt({
      city: String(userInfo?.city || ""), 
      organization_id: String(organizationId || ""),
      grade: selectedGrade,
      subject: selectedSubject,
      indicator: currentIndicatorName || "全部知識節點",
      period: periodLabel,
      selectedDate: selectedDate, 
      stats: {
        totalStudents: kpi.totalStudents,
        participationRate: kpi.participationRate,
        avgScore: currentAvgScore, 
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
      const currentIndicatorName = selectedIndicator ? (activeIndicatorSummary[0]?.indicate_name || selectedIndicator) : null;
      const currentAvgScore = selectedIndicator && activeIndicatorSummary.length > 0 ? activeIndicatorSummary[0].student_mastery_rate_pct : kpi.masteryRate;
      const chartLabels = selected.map((c) => TEACHER_CHART_LABELS[c]);
      const prompt = buildTeacherPracPrompt({
        city: String(userInfo?.city || ""), 
        organization_id: String(organizationId || ""),
        grade: selectedGrade,        
        subject: selectedSubject,
        indicator: currentIndicatorName || "全部知識節點",
        period: periodLabel,
        selectedDate: selectedDate,
        selectedCharts: selected, 
        stats: {
          totalStudents: kpi.totalStudents,
          participationRate: kpi.participationRate,
          avgScore: currentAvgScore,
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
  }, [selectedGrade, selectedSubject, selectedIndicator, activeIndicatorSummary, periodLabel, kpi, organizationId, userInfo?.city]);

  /* =========================
     工具函數
  ========================= */
  const wrapText = (str: string, len = 20) => {
    if (!str) return "";
    const reg = new RegExp(`(.{${len}})`, "g");
    return str.replace(reg, "$1<br>");
  };

  const CopyableUserId = ({ userId }: { userId: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(userId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000); // 2秒後恢復原狀
  };

  return (
    <div className="flex items-center gap-2 group">
      <span className="font-mono">{userId}</span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-violet-600 focus:outline-none"
        title="複製使用者 ID"
      >
        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
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

        <span className="text-sm">年級：</span>
        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
          <SelectTrigger className="w-[120px] bg-white border rounded"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_GRADE}>全部年級</SelectItem>
            {gradeOptions.map((grade) => <SelectItem key={grade} value={grade}>{grade} 年級</SelectItem>)}
          </SelectContent>
        </Select>

         <span className="text-sm">科目：</span>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-[150px] bg-white border rounded"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SUBJECT}>全部科目</SelectItem>
            {subjectOptions.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}
          </SelectContent>
        </Select>

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
      
          <div className="ml-auto text-xs text-slate-400 whitespace-nowrap">
            {periodLabel}
          </div>
      </div>

    {/* =========================
            KPI 區
  =========================  */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* KPI 1 */}
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

        {/* KPI 2 */}
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

        {/* KPI 3 */}
        <div className="flex flex-col border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-500 text-white text-sm font-bold py-2.5 px-3 text-center border-b border-slate-200">
            人均練習次數
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="flex items-baseline gap-1 font-black ">
              <span className="text-3xl font-black text-slate-800 tracking-tight">
                {kpi.avgPracPerStudent.toFixed(0)} 
              </span>
              <span className="text-lg font-bold  mb-1">次</span>
            </div>
          </div>
        </div>

        {/* KPI 4 */}
       <div 
          onClick={scrollToRiskTable}
          className={`flex flex-col bg-white border rounded-md overflow-hidden shadow-sm cursor-pointer transition-all active:scale-[0.98] group ${
            kpi.notMasteredStudents > 0 
              ? "border-rose-200 hover:shadow-md hover:border-rose-400" 
              : "border-slate-200 hover:shadow-md hover:border-slate-300"
          }`}
        >
          <div className={`text-white text-sm font-bold py-2.5 px-3 text-center border-b ${
            kpi.notMasteredStudents > 0 ? "bg-rose-500 border-rose-200" : "bg-slate-500 border-slate-200"
          }`}>
            需關注未精熟人數
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center p-5">
            <div className={`text-4xl font-black tracking-tight ${
              kpi.notMasteredStudents > 0 ? "text-rose-600" : "text-slate-300"
            }`}>
              {kpi.notMasteredStudents} 
              <span className={`text-lg font-bold ${
                kpi.notMasteredStudents > 0 ? "text-rose-400/70" : "text-slate-300/70"
              }`}>人</span>
            </div>
            <div className={`text-[11px] mt-2 font-medium px-2 py-1 rounded-full transition-colors ${
              kpi.notMasteredStudents > 0 
                ? "text-rose-400 group-hover:text-rose-600" 
                : "text-slate-400 group-hover:text-slate-600"
            }`}>
              {kpi.notMasteredStudents > 0 ? "點擊查看名單 ↓" : "全數達標，無需關注"}
            </div>
          </div>
        </div>

      </div>

      {/* =========================
            圖表區
  =========================  */}

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ===== 練習時間走勢圖 ===== */}
        <Card className="col-span-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}

            <CardHeader className="flex flex-row items-center justify-between py-4 pb-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-xl font-bold ">
                  練習時間走勢
                  <span className="px-2 text-xs text-violet-600">（ 科目：{selectedSubject} ）</span>
                </CardTitle>

                <span className="text-[11px] text-slate-400 font-normal">
                  點擊時間點，可查看該日期連動表現
                </span>
              </div>

            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#faf9fb] shadow-2xl border-violet-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-violet-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li><b className="text-violet-600">活躍學生人數 (長條圖)：</b>指該時間區段內有實際進行作答的學生人數</li>
                          <li><b className="text-violet-600">練習總次數 (折線圖)：</b>完成練習題的累計總量。</li>
                        </ul>
                        <p className="text-[12px] text-slate-400 pt-1 border-t">
                          ※ 透過此圖可觀察使用參與度與學習投入強度是否隨課程進度波動。<br/>
                          <span className="text-rose-500 font-bold">【提示】點擊圖表中的特定時間，可過濾下方所有的診斷資訊！</span>
                        </p>
                      </div>
                    </TooltipContent>                   
                </Tooltip>
              </TooltipProvider>

              <button
                onClick={() => runTeacherAIForChart("practice_trend")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-violet-500 hover:bg-violet-50 transition"
              >
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>

         
          <div className="flex items-center gap-1 mr-2 px-2">
            {selectedDate && (
              <span 
                className="ml-3 inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full cursor-pointer hover:bg-rose-200 transition" 
                onClick={() => setSelectedDate(null)}
              >
                時間區間：{selectedDate} <span className="text-xs leading-none">×</span>
              </span>
            )}
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
                  hovertemplate: "活躍學生人數：%{y}人<extra></extra>",
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
              onClick={(data) => {
                if (data.points && data.points.length > 0) {
                  const clickedDate = data.points[0].x as string;
                  setSelectedDate(prev => prev === clickedDate ? null : clickedDate);
                  setSelectedIndicator(null); 
                }
              }}
              layout={{
                autosize: true,
                margin: { t: 20, l: 45, r: 40, b: 30 },
                xaxis: { 
                  type: "category", tickangle: -35, tickfont: { size: 10 } ,color: "#64748b" },
                yaxis: { 
                  title: { text: "總練習人數", font: { size: 12, color: '#64748b' }, standoff: 15 },                  
                  side: "left", showgrid: true, zeroline: true},
                yaxis2: { 
                  title: { text: "總練習次數", font: { size: 12, color: '#64748b' }, standoff: 15 },                    
                  overlaying: "y", side: "right", showgrid: false, zeroline: false },
                legend: { orientation: "h", y: -0.25 },
                hovermode: "x unified",
                shapes: selectedDate ? [
                  {
                    type: "line", x0: selectedDate, x1: selectedDate, y0: 0, y1: 1, yref: "paper",
                    line: { color: "#e11d48", dash: "dot", width: 2 },
                  }
                ] : []
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
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xl font-bold ">
                正確率走勢
                <span className="px-2 text-xs text-violet-600">（ 科目：{selectedSubject} ）</span>
              </CardTitle>

              <span className="text-[11px] text-slate-400 font-normal">
                點擊時間點，可查看該日期連動表現
              </span>
            </div>

            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#faf9fb] shadow-2xl border-violet-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-violet-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li><b className="text-slate-700 font-bold">平均：</b>顯示目前在特定節點下的平均正確率走勢。</li>
                        </ul>
                        <p className="text-[12px] text-slate-400 pt-1 border-t">
                          ※ 透過此圖觀察曲線波動較大時，代表單元難度或教學進度可能有劇烈變化；若低於基準線，則建議進行補救教學。
                        </p>                       
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <button
                onClick={() => runTeacherAIForChart("performance_trend")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-violet-500 hover:bg-violet-50 transition"
              >
                <Bot className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>


          <div className="flex items-center gap-1 mr-2 px-2">

            {selectedDate && (
              <span 
                className="ml-3 inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full cursor-pointer hover:bg-rose-200 transition" 
                onClick={() => setSelectedDate(null)}
              >
                時間區間：{selectedDate} <span className="text-xs leading-none">×</span>
              </span>
            )}
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
              onClick={(data) => {
                if (data.points && data.points.length > 0) {
                  const clickedDate = data.points[0].x as string;
                  setSelectedDate(prev => prev === clickedDate ? null : clickedDate);
                  setSelectedIndicator(null); 
                }
              }}
              layout={{
                autosize: true,
                margin: { t: 30, l: 50, r: 30, b: 80 },
                xaxis: {
                  title: viewMode === "day" ? "日期" : viewMode === "week" ? "週起始日" : "月份",
                  type: "category", tickangle: -45, tickfont: { size: 10, color: "#64748b" },
                },
                yaxis: {
                  title: { text: "平均答對率 (%)", font: { size: 12, color: '#64748b' }, standoff: 15 , 
                           range: [0, 105], ticksuffix: "%", gridcolor: "#f1f5f9",}
                },
                legend: { orientation: "h", y: -0.3 },
                hovermode: "x unified",
                shapes: selectedDate ? [
                  {
                    type: "line", x0: selectedDate, x1: selectedDate, y0: 0, y1: 1, yref: "paper",
                    line: { color: "#e11d48", dash: "dot", width: 2 },
                  }
                ] : []
              }}
              style={{ width: "100%", height: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
        {/* ===== 教學診斷指標 ===== */}
         <Card className="col-span-1 relative">
           {loading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Activity className="animate-spin mr-2 w-4 h-4" />
                <span className="text-sm text-slate-600">資料分析中...</span>
              </div>
            )}

          <CardHeader className="flex flex-row items-center justify-between py-4 pb-0">
          <div className="flex flex-col-2 gap-1">
            <CardTitle 
              className="text-xl font-bold cursor-pointer hover:opacity-70 transition flex items-center gap-2 group"
              onClick={() => setSelectedIndicator(null)}
              >
              教學診斷指標
            </CardTitle>


            {selectedDate && (
              <span 
                className="ml-3 inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full cursor-pointer hover:bg-rose-200 transition" 
                onClick={() => setSelectedDate(null)}
              >
                時間區間：{selectedDate} <span className="text-xs leading-none">×</span>
              </span>
            )}
            </div>
            
            
            <div className="flex items-center gap-1">
              
              
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#faf9fb] shadow-2xl border-violet-200 text-slate-700 z-50">
                    <div className="space-y-3">
                      <p className="font-bold border-b pb-1 text-violet-900 flex items-center gap-1">圖表計算說明：</p>
                      <ul className="text-xs space-y-3">
                        <li className="flex gap-2">
                          <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1" />
                          <span>
                            <b className="text-blue-700 text-[13px]">精熟區 (參與高、得分高)</b><br/>
                            參與率高且正確率穩定。該單元全校掌握度高，可規劃進階挑戰。
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500 mt-1" />
                          <span>
                            <b className="text-emerald-700 text-[13px]">潛力區 (參與低、得分高)</b><br/>
                            參與率低但得分高。可能為少數學生超前練習，或該單元難度較易。
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="shrink-0 w-2 h-2 rounded-full bg-amber-500 mt-1" />
                          <span>
                            <b className="text-amber-700 text-[13px]">低參與 (參與低、得分低)</b><br/>
                            多為尚未進行全班性教學之單元，樣本數不足，需先引導學生上線作答。
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="shrink-0 w-2 h-2 rounded-full bg-rose-500 mt-1" />
                          <span>
                            <b className="text-rose-700 text-[13px]">瓶頸區 (參與高、得分低)</b><br/>
                            多數學生已作答卻普遍卡關。代表存在共同學習痛點，<b className="text-rose-600 font-bold">需優先介入補救教學</b>。
                          </span>
                        </li>
                      </ul>
                      <p className="text-[12px] text-slate-400 pt-1 border-t leading-relaxed">
                          ※ 透過此圖可精準識別全校在各單元的教學進度 (參與率)與實質成效 (正確率)之關聯。
                        </p>     
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <button
                onClick={() => runTeacherAIForChart("diagnostic")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-violet-500 hover:bg-violet-50 transition"
              >
                <Bot className="w-5 h-5" />
              </button>
            </div>

          </CardHeader>
          <div className="flex items-center gap-2 py-2 px-6">
            {!selectedIndicator && (
                <span className="text-[11px] text-slate-400 font-normal">
                  點擊圖表圓點，可查看單一知識節點連動表現
                </span>
              )}
              </div>
            
          <CardContent className="h-[300px] w-full">
            {selectedIndicator && (
              <div>
                <span className="text-[12px] font-bold text-blue-700 ">
                  已選取：{activeIndicatorSummary.find(r=>r.indicator===selectedIndicator)?.indicate_name || selectedIndicator}
                </span>
              </div>
            )}
            <Plot
              data={[
                {
                  x: quadrantData.rows.map(r => r.xValue), 
                  y: quadrantData.rows.map(r => r.yValue), 
                  customdata: quadrantData.rows.map(r => r.id),
                  mode: "markers",
                  marker: {
                    size: quadrantData.rows.map(r => selectedIndicator === r.id ? 18 : 12),
                    color: quadrantData.rows.map(r => {
                      if (selectedIndicator && selectedIndicator !== r.id) return "rgba(203, 213, 225, 0.4)";
                      // 根據相對參與率與正確率決定顏色
                      return r.yValue >= quadrantData.yAvg 
                        ? (r.xValue >= quadrantData.xAvg ? "rgba(37, 100, 235, 0.8)" : "rgba(22, 163, 74, 0.8)") 
                        : (r.xValue >= quadrantData.xAvg ? "rgba(220, 38, 38, 0.8)" : "rgba(154, 154, 154, 1)");
                    }),
                    opacity: 0.6,
                    line: { color: 'white', width: 1 }
                  },
                  text: quadrantData.rows.map(r => wrapText(r.name, 20)),
                  hovertemplate: 
                    "<b>知識節點：%{text}</b><br>" +
                    "參與率：%{x:.1f}%<br>" + 
                    "精熟率：%{y:.1f}%<br>" +
                    "<extra></extra>",
                  hoverlabel: { align: "left", namelength: -1, font: { color: "#ffffff" } }
                }
              ]}
              onClick={(data) => {
                if (data.points && data.points.length > 0) {
                  const pointIndex = data.points[0].pointIndex;
                  const clickedIndicatorId = quadrantData.rows[pointIndex].id;
                  setSelectedIndicator(prev => prev === clickedIndicatorId ? null : clickedIndicatorId);
                }
              }}
              layout={{
                height: 260,
                margin: { t: 30, r: 10, b: 50, l: 60 },
                xaxis: { 
                  title: { text: "參與率 (%)", font: { size: 12, color: '#64748b' }, standoff: 15 },                                 
                  range: [0, quadrantData.maxX * 1.2], 
                  gridcolor: '#f1f5f9', zeroline: false 
                },
                yaxis: { 
                  title: { text: "平均正確率 (%)", font: { size: 12, color: '#64748b' }, standoff: 15 },
                  range: [-5, 110], gridcolor: '#f1f5f9', zeroline: false 
                },
                shapes: [
                  { type: "line", x0: quadrantData.xAvg, x1: quadrantData.xAvg, y0: 0, y1: 100, line: { color: "#94a3b8", dash: "dot", width: 2 } },
                  { type: "line", x0: 0, x1: quadrantData.maxX * 1.2, y0: quadrantData.yAvg, y1: quadrantData.yAvg, line: { color: "#94a3b8", dash: "dot", width: 2 } },
                ],
                annotations: [
                  { x: quadrantData.maxX * 1.15, y: 105, text: "<b>精熟區</b>", showarrow: false, xanchor: 'right', font: { color: "#2563eb" } },
                  { x: 0, y: 105, text: "<b>潛力區</b>", showarrow: false, xanchor: 'left', font: { color: "#16a34a" } },
                  { x: 0, y: 5, text: "<b>低參與</b>", showarrow: false, xanchor: 'left', font: { color: "#727272ff" } },
                  { x: quadrantData.maxX * 1.15, y: 5, text: "<b>瓶頸區</b>", showarrow: false, xanchor: 'right', font: { color: "#dc2626" } },
                ]
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "100%" }}
            />
          </CardContent>
        </Card>
      </div>


      {/* =========================
          知識節點熱力圖
      ========================= */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <Card className="col-span-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Activity className="animate-spin mr-2 w-4 h-4" />
              <span className="text-sm text-slate-600">資料分析中...</span>
            </div>
          )}
        
          <CardHeader className="flex flex-row items-center justify-between py-4 pb-4">
            <div className="flex flex-col-2 gap-1">
            <CardTitle 
              className="text-xl font-bold cursor-pointer hover:opacity-70 transition flex items-center gap-2 group"
              onClick={() => setSelectedIndicator(null)}
              >
              知識節點熱力圖
            </CardTitle>

            {selectedDate && (
              <span 
                className="ml-3 inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full cursor-pointer hover:bg-rose-200 transition" 
                onClick={() => setSelectedDate(null)}
              >
                時間區間：{selectedDate} <span className="text-xs leading-none">×</span>
              </span>
            )}
            </div>

            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs p-4 bg-[#faf9fb] shadow-2xl border-violet-200 text-slate-700 z-50">
                      <div className="space-y-3">
                        <p className="font-bold border-b pb-1 text-violet-700">圖表計算說明：</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                          <li>
                            <b className="text-slate-700 font-bold">區塊大小：</b>
                            代表該知識節點的參與練習人數。越大的方塊代表該單元學生練習較集中，或為近期教學重點。
                          </li>
                          <li>
                            <b className="text-slate-700 font-bold">區塊顏色：</b>
                            代表平均精熟率。<span className="text-violet-200 font-bold">顏色偏白</span>表示精熟率低（需優先關注），<span className="text-violet-600 font-bold">顏色深紫</span>表示精熟率高（已達標）。
                          </li>
                        </ul>
                        <p className="text-[11px] text-slate-500 pt-1 border-t">
                          ※ 提示：請特別注意<b className="text-violet-600">「面積大但顏色偏白」</b>的區塊，這通常是全校共同的學習瓶頸。
                        </p> 
                      </div>
                    </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <button
                onClick={() => runTeacherAIForChart("indicator_treemap")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-violet-500 hover:bg-violet-50 transition"
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
                      [0, '#f7f7f7ff'],       
                      [0.4, '#ddd6fe'],     
                      [0.7, '#a78bfa'],     
                      [1, '#621bddff']        
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
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">無知識節點數據</div>
            )}
          </CardContent>

          {/* 教學洞察預警 */}
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 p-4">
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
          </div>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* 待關注學生名單 */}
          <Card className="col-span-1 relative overflow-hidden border-slate-200 shadow-sm"  ref={riskCardRef}>
            {loading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Activity className="animate-spin mr-2 w-4 h-4" />
                <span className="text-sm text-slate-600">資料分析中...</span>
              </div>
            )}
          
          <CardHeader className="flex flex-row items-center justify-between py-4 pb-2">
            <CardTitle className="text-xl font-bold text-slate-800">
              高風險學生與弱點知識節點 <span className="px-2 text-xs text-violet-600">（ 科目：{selectedSubject} ）</span>
              
              
              {selectedDate && (
              <span 
                className="ml-3 inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full cursor-pointer hover:bg-rose-200 transition" 
                onClick={() => setSelectedDate(null)}
              >
                時間區間：{selectedDate} <span className="text-xs leading-none">×</span>
              </span>
            )}
            
            </CardTitle>
              
              <div className="flex items-center gap-1">
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
                          <b className="text-slate-700 font-bold">未精熟節點數：</b>
                          指該生在特定單元中，最後一次作答正確率<span className="text-rose-600 font-bold">未達滿分(100分)</span> 的單元總數。
                        </li>
                        <li>
                          <b className="text-slate-700 font-bold">練習節點數：</b>
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
                    <th className="p-3 w-40">練習節點數</th>
                    <th className="p-3 w-40">未精熟節點數</th> 
                    <th className="p-3 w-40 text-center">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {studentRiskRanking.length > 0 ? (
                    studentRiskRanking.map((student) => (
                      <tr key={student.userId} className="hover:bg-slate-50 transition group">
                        <td className="px-8 py-3 text-sm font-medium text-slate-700">
                          <CopyableUserId userId={student.userId} />
                          </td>

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
                        
                        <td className="px-4 py-3">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-rose-600 font-bold border-b border-rose-200 cursor-help">
                                  {student.unmasteredCount}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="bg-rose-50 shadow-2xl border-rose-200 text-slate-800">
                                <p className="text-sm font-bold mb-1">待加強節點：</p>
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
                        {selectedDate ? `在 ${selectedDate} 沒有發現高風險學生數據` : "目前無待關注之高風險名單，或尚無作答數據"}
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