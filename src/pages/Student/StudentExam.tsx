// src/pages/StudentExam.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import { supabase } from "@/lib/supabase";
import { useUserContext } from "@/contexts/UserContext";
import { groupBy, sortBy, keyBy, meanBy } from "lodash";
import {Card, CardHeader, CardTitle, CardContent, CardDescription} from "@/components/ui/card";
import {Select, SelectTrigger, SelectValue, SelectContent, SelectItem} from "@/components/ui/select";
import {
  ArrowLeft,
  Activity,
  Target,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from "lucide-react";

/* =========================
   Types
   ========================= */

interface ExamDailyRow {
  user_sn: string;
  attempt_date: string; 
  attempt_count: number;
  avg_accuracy: number; 
  avg_response_time: number; 
  total_duration_sec: number;
}

interface MissionPerformanceRow {
  user_sn: number;
  mission_id: string;
  object_type: string;
  attempt_no: number;
  attempt_time: string;
  attempt_date: string;
  total_questions: number;
  correct_count: number;
  accuracy_rate: number; // 0–100
  mission_time_sec: number;
}

interface ClassMissionPerformanceRow {
  object_type: string;
  mission_id: string;
  student_count: number;
  avg_accuracy_rate: number;   // 0–100
  avg_mission_time_sec: number;
  avg_speed_sec: number;
  total_questions: number;
}

interface QuestionAttemptRow {
  user_sn: number;
  mission_id: string;
  attempt_no: number;
  question_id: string;
  result_success: boolean;
  answer_time_sec: number | null;
}



/* =========================
   Component
   ========================= */
export default function StudentExam() {
  const { userSn, organizationId, gradeId, classId } = useUserContext();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MissionPerformanceRow[]>([]);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedMission, setSelectedMission] = useState<string>("all");
  const [examDaily, setExamDaily] = useState<ExamDailyRow[]>([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [classMissionRows, setClassMissionRows] = useState<ClassMissionPerformanceRow[]>([]);
  const [questionRows, setQuestionRows] = useState<QuestionAttemptRow[]>([]);
  const [questionLoading, setQuestionLoading] = useState(false);


  /* =========================
     Fetch student data
     ========================= */
  useEffect(() => {
    if (!userSn) return;

    const fetchData = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("dp002_mission_performance")
        .select(`
        mission_id::text,
        attempt_no,
        object_type,
        attempt_time,
        attempt_date,
        total_questions,
        correct_count,
        accuracy_rate,
        mission_time_sec
      `)
        .eq("user_sn", userSn)
        .order("attempt_time", { ascending: true });

      if (error) {
        console.error("fetch student mission error", error);
        setRows([]);
      } else {
        setRows((data as MissionPerformanceRow[]) ?? []);
      }

      setLoading(false);
    };

    fetchData();
  }, [userSn]);

  /* =========================
     Filtered student rows
     ========================= */
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedType !== "all" && r.object_type !== selectedType)
        return false;

      if (
        selectedMission !== "all" &&
        String(r.mission_id) !== selectedMission
      )
        return false;

      return true;
    });
  }, [rows, selectedType, selectedMission]);

  /* =========================
     Fetch daily
     ========================= */

  useEffect(() => {
    if (!userSn) return;
  
    const fetchExamDaily = async () => {
      const { data } = await supabase
        .from("dp002_exam_daily")
        .select("*")
        .eq("user_sn", userSn)
        .order("attempt_date", { ascending: true });
  
      if (data) setExamDaily(data as ExamDailyRow[]);
    };
  
    fetchExamDaily();
    }, [userSn]);
  
  //日期序列產生器
  function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cur = new Date(start);
  const endDate = new Date(end);

  while (cur <= endDate) {
    dates.push(cur.toISOString().slice(0, 10)); // yyyy-mm-dd
    cur.setDate(cur.getDate() + 1);
  }

  return dates;
}

  /* =========================
     Fetch class mission performance
     ========================= */
  useEffect(() => {
  if (!filteredRows.length) {
    setClassMissionRows([]);
    return;
  }

  if (organizationId == null || gradeId == null || classId == null) {
    setClassMissionRows([]);
    return;
  }

  const fetchClassMission = async () => {
    const objectTypes = Array.from(
      new Set(filteredRows.map(r => r.object_type))
    );

    const { data, error } = await supabase
      .from("dp002_class_mission_performance")
      .select(`
        mission_id::text,
        object_type,
        student_count,
        avg_accuracy_rate,
        avg_mission_time_sec,
        avg_speed_sec,
        total_questions
      `)
      .eq("organization_id", Number(organizationId))
      .eq("grade", Number(gradeId))
      .eq("class", Number(classId))
      .in("object_type", objectTypes);

    if (error) {
      console.error("fetchClassMission error", error);
      setClassMissionRows([]);
      return;
    }

    setClassMissionRows(data ?? []);
  };

  fetchClassMission();
}, [filteredRows, organizationId, gradeId, classId]);

const missionIdOptions = useMemo<MissionPerformanceRow[]>(() => {
  if (!rows.length) return [];

  const byMission = groupBy(
    rows,
    r => String(r.mission_id)
  ) as Record<string, MissionPerformanceRow[]>;

  return Object.values(byMission).map((attempts) =>
    attempts.reduce((prev, cur) =>
      cur.attempt_no > prev.attempt_no ? cur : prev
    )
  );
}, [rows]);

useEffect(() => {
  if (!userSn || selectedMission === "all") {
    setQuestionRows([]);
    return;
  }

  const fetchQuestionAttempts = async () => {
    const { data, error } = await supabase
      .from("dp002_exam_question_attempt")
      .select(`
        user_sn,
        mission_id,
        attempt_no,
        question_id,
        result_success,
        answer_time_sec
      `)
      .eq("user_sn", userSn)
      .eq("mission_id", selectedMission)
      .order("attempt_no", { ascending: true });

    if (error) {
      console.error("fetch question attempt error", error);
      setQuestionRows([]);
      return;
    }

    setQuestionRows(data ?? []);
  };

  fetchQuestionAttempts();
}, [userSn, selectedMission]);

const maxAttemptNo = useMemo(() => {
  if (!questionRows.length) return 0;
  return Math.max(...questionRows.map(r => r.attempt_no));
}, [questionRows]);

const groupedByQuestion = useMemo<Record<string, QuestionAttemptRow[]>>(() => {
  if (!questionRows.length) return {};
  return groupBy(questionRows, r => r.question_id);
}, [questionRows]);


const groupedQuestionRows = useMemo<Record<string, QuestionAttemptRow[]>>(() => {
  if (!questionRows.length) return {};

  return groupBy(
    questionRows,
    (r) => r.question_id
  );
}, [questionRows]);

  //* Exam view */


const filteredExamDaily = useMemo(() => {
  const { start, end } = dateRange;

  return examDaily.filter(r => {
    if (start && r.attempt_date < start) return false;
    if (end && r.attempt_date > end) return false;
    return true;
  });
}, [examDaily, dateRange]);

  const examKPI = useMemo(() => {
  if (!filteredExamDaily.length) {
    return { totalCount: 0, totalMin: 0, avgAcc: 0 };
  }

  return {
    totalCount: filteredExamDaily.reduce((s, r) => s + r.attempt_count, 0),
    totalMin: Math.round(
      filteredExamDaily.reduce((s, r) => s + r.total_duration_sec, 0) / 60
    ),
    avgAcc: Math.round(
      filteredExamDaily.reduce((s, r) => s + r.avg_accuracy, 0) /
      filteredExamDaily.length
    ),
  };
}, [filteredExamDaily]);



  /* =========================
     KPI
     ========================= */
  const kpi = useMemo(() => {
    if (!filteredRows.length) {
      return {
        totalAttempt: 0,
        totalMin: 0,
        avgAcc: 0,
        avgSpeed: 0,
      };
    }

    return {
      totalAttempt: filteredRows.length,
      totalMin: Math.round(
        filteredRows.reduce((s, r) => s + r.mission_time_sec, 0) / 60
      ),
      avgAcc: Math.round(
        filteredRows.reduce((s, r) => s + r.accuracy_rate, 0) /
          filteredRows.length
      ),
      avgSpeed: Math.round(
        filteredRows.reduce((s, r) => s + r.mission_time_sec, 0) /
          filteredRows.length
      ),
    };
  }, [filteredRows]);

  const processedStats = useMemo(() => {
  if (!filteredRows.length) {
    return { improvedCount: 0, perfectCount: 0 };
  }

  const byMission = groupBy(
    filteredRows,
    r => r.mission_id
  ) as Record<string, MissionPerformanceRow[]>;

  let improvedCount = 0;
  let perfectCount = 0;

  Object.values(byMission).forEach((attempts) => {
    if (attempts.length === 0) return;

    const sorted = sortBy(attempts, "attempt_no");

    const firstAcc = sorted[0]?.accuracy_rate ?? 0;
    const lastAcc = sorted[sorted.length - 1]?.accuracy_rate ?? 0;

    if (firstAcc === 100) {
      perfectCount += 1;
      return;
    }

    if (firstAcc < 60 && lastAcc >= 60) {
      improvedCount += 1;
    }
  });

  return { improvedCount, perfectCount };
}, [filteredRows]);


const kpiClass = useMemo(() => {
  if (!filteredRows.length || !classMissionRows.length) {
    return {
      avgAccStudent: 0,
      avgAccClass: null,
      avgSpeedStudent: 0,
      avgSpeedClass: null,
      belowClassCount: 0,
      classStudentCount: 0,
    };
  }

  /* ① 建立 mission_id → 班級資料索引 */
  const byMissionClass = keyBy(
    classMissionRows,
    r => String(r.mission_id)
  );

  /* ② 學生平均（目前篩選後資料） */
  const avgAccStudent =
    meanBy(filteredRows, r => r.accuracy_rate) ?? 0;

  const avgSpeedStudent =
    meanBy(
      filteredRows,
      r =>
        r.total_questions > 0
          ? r.mission_time_sec / r.total_questions
          : 0
    ) ?? 0;

  /* ③ 目前畫面使用到的 mission_id */
  const missionIds = Array.from(
    new Set(filteredRows.map(r => String(r.mission_id)))
  );

  /* ④ 對應的班級資料 */
  const matchedClassRows = missionIds
    .map(mid => byMissionClass[mid])
    .filter(Boolean) as ClassMissionPerformanceRow[];

  if (!matchedClassRows.length) {
    return {
      avgAccStudent: Math.round(avgAccStudent),
      avgAccClass: null,
      avgSpeedStudent: Number(avgSpeedStudent.toFixed(1)),
      avgSpeedClass: null,
      belowClassCount: 0,
      classStudentCount: 0,
    };
  }

  /* ⑤ 班級平均（只針對學生實際有作答的測驗） */
  const avgAccClass =
    meanBy(matchedClassRows, r => r.avg_accuracy_rate) ?? 0;

  const avgSpeedClass =
    meanBy(matchedClassRows, r => r.avg_speed_sec) ?? 0;

  /* ⑥ 班級人數（單一測驗直接取，多測驗取最大） */
  const classStudentCount =
    matchedClassRows.length === 1
      ? matchedClassRows[0].student_count ?? 0
      : Math.max(...matchedClassRows.map(r => r.student_count ?? 0));

  /* =====================================================
   ⑦ 低於班級平均（每個 mission 只看「最新一次」）
   ===================================================== */
    const latestByMission = Object.values(
      groupBy(filteredRows, r => String(r.mission_id))
    ) as MissionPerformanceRow[][]; 

    let belowClassCount = 0;

    latestByMission.forEach((rows) => {
      if (!rows.length) return;

      const latest = rows.reduce((prev, cur) =>
        cur.attempt_no > prev.attempt_no ? cur : prev
      );

      const cls = byMissionClass[String(latest.mission_id)];
      if (!cls) return;

      if (latest.accuracy_rate < cls.avg_accuracy_rate) {
        belowClassCount += 1;
      }
    });


      return {
        avgAccStudent: Math.round(avgAccStudent),
        avgAccClass: Math.round(avgAccClass),
        avgSpeedStudent: Number(avgSpeedStudent.toFixed(1)),
        avgSpeedClass: Number(avgSpeedClass.toFixed(1)),
        belowClassCount,
        classStudentCount,
      };
    }, [filteredRows, classMissionRows]);

    //是否已達學習目標
    const reachedGoal =
      processedStats.improvedCount + processedStats.perfectCount > 0;

    //學習歷程最新一次作答注記
    const latestAttempt = useMemo(() => {
      if (!filteredRows.length) return null;
      return filteredRows.reduce((prev, cur) =>
        cur.attempt_no > prev.attempt_no ? cur : prev
      );
    }, [filteredRows]);







  /* =========================
     Render
     ========================= */
  if (loading) return <div className="p-20 text-center flex items-center justify-center h-screen text-slate-500"><Activity className="animate-spin mr-2"/> 分析資料載入中...</div>;

  const hasData = rows.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-6">
    {/* ===== 無資料：只顯示提示，不顯示 Card ===== */}
        {!hasData && (
          <div className="flex flex-col items-center justify-center h-[300px] text-slate-500 space-y-5">
            <div className="text-2xl font-medium">
              該學生在此平台沒有學習紀錄
            </div>
          </div>
        )}
      
      {/* 1. Header & Filter */}
      {/* Header */}
      
        {/* ===== Exam Overview Card ===== */}
        {hasData && (
          <Card className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">每日測驗答題狀況 </h3>
          </div>
          

            <Plot
              data={[
                {
                  x: filteredExamDaily.map(r => r.attempt_date),
                  y: filteredExamDaily.map(r => r.attempt_count),
                  type: "bar",
                  name: "測驗次數",
                  base: 0,                               
                  offsetgroup: "count",
                  width: 24 * 60 * 60 * 1000 * 0.7,     
                  marker: { color: "#60a5fa", opacity: 0.7 },
                  hovertemplate:
                    "日期：%{x}<br>" +
                    "測驗次數：%{y}<extra></extra>",
                },
                {
                  x: filteredExamDaily.map(r => r.attempt_date),
                  y: filteredExamDaily.map(r => r.avg_accuracy),
                  type: "scatter",
                  mode: "lines+markers",
                  yaxis: "y2",
                  name: "平均正確率（%）",
                  marker: { size: 6 },
                  line: { color: "#f97316", width: 3 },
                  hovertemplate:
                    "日期：%{x}<br>"+
                    "正確率：%{y}%<extra></extra>",
                },
                {
                  x: filteredExamDaily.map(r => r.attempt_date),
                  y: filteredExamDaily.map(r => r.avg_response_time),
                  type: "scatter",
                  mode: "lines+markers",
                  yaxis: "y2",
                  name: "平均作答時間（秒）",
                  line: { color: "#10b981", width: 3, dash: "dot" },
                  hovertemplate:
                    "日期：%{x}<br>"+
                    "作答時間：%{y:.1f} 秒<extra></extra>",
                },
              ]}
              useResizeHandler
              style={{ width: "100%"}}
              layout={{
                  autosize: true,
                  height: 250,
                  margin: { t: 20, l: 50, r: 50, b: 90 },   
                  xaxis: {
                    title: "日期",
                    tickmode: "array",                
                    tickvals: filteredExamDaily.map(r => r.attempt_date),
                    ticktext: filteredExamDaily.map(r => r.attempt_date),
                    tickangle: -30,
                    tickfont: { size: 10 },
                  },
                  yaxis: {
                    title: "測驗次數",
                    rangemode: "tozero",  
                    showgrid: true,
                    zeroline: true,                      
                  },
                  yaxis2: {
                    title: "正確率 / 作答時間",
                    overlaying: "y",
                    side: "right",
                    showgrid: false,
                    zeroline: false, 
                  },
                  legend: { orientation: "h", y: -0.35 },
                }}

              config={{ responsive: true, displayModeBar: false }}
              onClick={(e) => {
                if (!e.points?.length) return;
                const date = e.points[0].x as string;

                navigate("/student/exam", {
                  state: { activity_date: date, dateRange }, 
                });
              }}
            />

            {/* KPI */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-slate-500">總測驗次數</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {examKPI.totalCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">總測驗時間</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {examKPI.totalMin} 分
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">平均正確率</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {examKPI.avgAcc}%
                </p>
              </div>
            </div>
          </Card>
          )}
        
      {hasData && (
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        {/* Filters */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
          <div className="p-2 text-slate-400">
              <Filter className="w-4 h-4"/>
            </div>

          {/* 測驗類型 */}
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[160px] border-none focus:ring-0 font-medium text-slate-700">
              <SelectValue placeholder="選擇類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有類型</SelectItem>
              {[...new Set(rows.map((r) => r.object_type))].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 測驗流水號 */}
          <Select value={selectedMission} onValueChange={setSelectedMission}>
            <SelectTrigger className="w-[450px] border-none focus:ring-0 font-medium text-slate-700">
              <SelectValue placeholder="選擇測驗" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有測驗</SelectItem>

              {missionIdOptions.map((m) => (
                <SelectItem key={m.mission_id} value={String(m.mission_id)}>
                  測驗 {m.mission_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

        </div>
      </div>
      )}

      {/* 2. KPI Cards */}
      {hasData && (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

        {/* KPI 1: 次數 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-sm font-medium">總測驗次數</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{kpi.totalAttempt}</div>
          </CardContent>
        </Card>

        {/* KPI 2: 時間 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-sm font-medium">投入時間</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{`${kpi.totalMin} 分`}</div>
          </CardContent>
        </Card>

        {/* KPI 3: 平均正確率 */}
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium">平均正確率</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-bold">
              {kpi.avgAcc}%
            </div>
            <p className="text-xs text-slate-500">
              班級平均 {kpiClass.avgAccClass}%
              <span
                className={
                  kpiClass.avgAccStudent >= kpiClass.avgAccClass
                    ? "text-green-600 ml-1"
                    : "text-red-600 ml-1"
                }
              >
                ({kpiClass.avgAccStudent - kpiClass.avgAccClass}%)
              </span>
            </p>
          </CardContent>
        </Card>


        {/* KPI 4: 平均答題速度 */}
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium">平均答題速度</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-bold">
              {kpiClass.avgSpeedStudent} 秒
            </div>
            <p className="text-xs text-slate-500">
              班級平均 {kpiClass.avgSpeedClass} 秒
              <span
                className={
                  kpiClass.avgSpeedStudent <= kpiClass.avgSpeedClass
                    ? "text-green-600 ml-1"
                    : "text-red-600 ml-1"
                }
              >
                ({(kpiClass.avgSpeedClass - kpiClass.avgSpeedStudent).toFixed(1)} 秒)
              </span>
            </p>
          </CardContent>
        </Card>


        {/* KPI 5: 低於班級平均 */}
        <Card
          className={
            kpiClass.belowClassCount > 0
              ? "border-red-300 bg-red-50/50"
              : "border-green-300 bg-green-50/50"
          }
        >
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium">
              低於班級平均
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 pt-0 space-y-1">
            <div
              className={`text-2xl font-bold ${
                kpiClass.belowClassCount > 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {kpiClass.belowClassCount > 0 ? "是" : "否"}
            </div>

            <p className="text-xs text-slate-500">
              班級總練習人數 {kpiClass.classStudentCount} 人
            </p>
          </CardContent>
        </Card>

        {/* KPI 6: 已達學習目標 */}
        <Card
          className={
            reachedGoal
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
                reachedGoal ? "text-green-600" : "text-red-600"
              }`}
            >
              {reachedGoal ? "是" : "否"}
            </div>

            {/* 說明（保留學術可解釋性） */}
            <div className="text-xs text-slate-600 space-y-1">
              <div>
                已克服弱點：
                <span className="font-medium text-slate-800 ml-1">
                  {processedStats.improvedCount}
                </span>
              </div>
              <div>
                測驗已滿分：
                <span className="font-medium text-slate-800 ml-1">
                  {processedStats.perfectCount}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
      )}

    {/* 3. Charts */}
    {hasData && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1: 測驗投入成效（含班級平均） */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>測驗投入成效</CardTitle>
          <CardDescription>
            呈現學生多次作答中正確率（左軸）與作答時間（右軸）的變化趨勢；
            虛線為該測驗班級平均表現。
          </CardDescription>
        </CardHeader>

        <CardContent className="w-full h-[340px]">
          <Plot
            data={[
              /* ===============================
                學生正確率（左軸）
              =============================== */
              {
                x: filteredRows.map(r => r.attempt_no),
                y: filteredRows.map(r => r.accuracy_rate),
                type: "scatter",
                mode: "lines+markers",
                name: "學生正確率",
                marker: { size: 7, color: "#2563eb" },
                line: { width: 3, color: "#2563eb" },
              },

              /* ===============================
                學生作答時間（右軸）
              =============================== */
              {
                x: filteredRows.map(r => r.attempt_no),
                y: filteredRows.map(r => r.mission_time_sec),
                type: "scatter",
                mode: "lines+markers",
                name: "學生作答時間",
                yaxis: "y2",
                marker: { size: 7, color: "#f97316" },
                line: { width: 3, color: "#f97316" },
              },

              /* ===============================
                班級平均正確率（左軸虛線）
              =============================== */
              ...(kpiClass.avgAccClass !== null
                ? [{
                    x: filteredRows.map(r => r.attempt_no),
                    y: filteredRows.map(() => kpiClass.avgAccClass),
                    type: "scatter",
                    mode: "lines",
                    name: `班級平均正確率 (${kpiClass.avgAccClass}%)`,
                    line: {
                      color: "#93c5fd",
                      width: 2,
                      dash: "dash",
                    },
                    hoverinfo: "skip",
                  }]
                : []),

              /* ===============================
                班級平均作答時間（右軸虛線）
              =============================== */
              ...(kpiClass.avgSpeedClass !== null
                ? [{
                    x: filteredRows.map(r => r.attempt_no),
                    y: filteredRows.map(() => kpiClass.avgSpeedClass),
                    type: "scatter",
                    mode: "lines",
                    name: `班級平均作答時間 (${kpiClass.avgSpeedClass} 秒)`,
                    yaxis: "y2",
                    line: {
                      color: "#fdba74",
                      width: 2,
                      dash: "dash",
                    },
                    hoverinfo: "skip",
                  }]
                : []),
            ]}
            layout={{
              height: 320,
              margin: { l: 50, r: 60, t: 30, b: 60 },

              /* ===== X 軸 ===== */
              xaxis: {
                title: "測驗作答次數（作答順序）",
                tickmode: "linear",
                tick0: 1,
                dtick: 1,
              },

              /* ===== 左 Y 軸 ===== */
              yaxis: {
                title: "正確率（%）",
                range: [0, 110],
                showgrid: false,
              },

              /* ===== 右 Y 軸 ===== */
              yaxis2: {
                title: "作答時間（秒）",
                overlaying: "y",
                side: "right",
                showgrid: false,
                zeroline: false,
              },

              /* ===== Legend ===== */
              legend: {
                orientation: "h",
                y: -0.35,
              },
            }}
            config={{
              responsive: true,
              displayModeBar: true,
            }}
            style={{ width: "100%", height: "100%" }}
          />
        </CardContent>
      </Card>





      {/* ===== Learning Quadrant：學習歷程表現 ===== */}
      <Card>
        <CardHeader>
          <CardTitle>學習歷程表現</CardTitle>
          <CardDescription>
            每個點代表一次測驗，依正確率與作答時間分布於四個學習區域，
            用以觀察多次複習測驗是否有達學習成效。
          </CardDescription>
        </CardHeader>

        <CardContent className="w-full h-[340px]">
          <Plot
            data={[
              /* ===== 所有歷次作答 ===== */
              {
                x: filteredRows.map(r => r.mission_time_sec),
                y: filteredRows.map(r => r.accuracy_rate),
                type: "scatter",
                mode: "markers+text",
                text: filteredRows.map(r => `${r.attempt_no}`),
                textposition: "top center",
                marker: {
                  size: 11,
                  color: filteredRows.map(r => {
                    if (r.accuracy_rate >= 60 && r.mission_time_sec <= kpi.avgSpeed) return "#22c55e"; // 精熟
                    if (r.accuracy_rate >= 60) return "#3b82f6"; // 穩定
                    if (r.mission_time_sec <= kpi.avgSpeed) return "#f97316"; // 猜測
                    return "#ef4444"; // 卡關
                  }),
                },
                hovertemplate:
                  "第 %{customdata} 次嘗試<br>" +
                  "正確率：%{y}%<br>" +
                  "作答時間：%{x} 秒<extra></extra>",
                customdata: filteredRows.map(r => r.attempt_no),
                name: "歷次作答",
              },

              /* ===== 最新一次作答（高亮，不顯示 hover） ===== */
              ...(latestAttempt
                ? [{
                    x: [latestAttempt.mission_time_sec],
                    y: [latestAttempt.accuracy_rate],
                    type: "scatter",
                    mode: "markers",
                    marker: {
                      size: 16,
                      color: "rgba(255, 255, 255, 0.1)",
                      line: {
                        color: "#f4f800ff",
                        width: 3,
                      },
                    },
                    name: "最近一次作答",
                    hoverinfo: "skip",
                  }]
                : []),
            ]}
            layout={{
              height: 320,
              margin: { l: 50, r: 40, t: 30, b: 60 },

              /* ===== X 軸 ===== */
              xaxis: {
                title: "作答時間（秒）",
                zeroline: false,
              },

              /* ===== Y 軸（修正上限） ===== */
              yaxis: {
                title: "正確率（%）",
                range: [0, 125], 
                zeroline: false,
              },

              /* ===== 四象限分界線 ===== */
              shapes: [
                /* 垂直線：學生平均作答時間 */
                {
                  type: "line",
                  x0: kpi.avgSpeed,
                  x1: kpi.avgSpeed,
                  y0: 0,
                  y1: 100,
                  line: {
                    color: "#94a3b8",
                    dash: "dot",
                    width: 2,
                  },
                },

                /* 水平線：60% 正確率門檻 */
                {
                  type: "line",
                  x0: 0,
                  x1: Math.max(...filteredRows.map(r => r.mission_time_sec)) * 1.1,
                  y0: 60,
                  y1: 60,
                  line: {
                    color: "#94a3b8",
                    dash: "dot",
                    width: 2,
                  },
                },
              ],

              /* ===== 區域標註 ===== */
              annotations: [
                { x: kpi.avgSpeed * 0.6, y: 85, text: "精熟區", showarrow: false, font: { color: "#22c55e" } },
                { x: kpi.avgSpeed * 1.4, y: 85, text: "穩定區", showarrow: false, font: { color: "#3b82f6" } },
                { x: kpi.avgSpeed * 0.6, y: 25, text: "猜測區", showarrow: false, font: { color: "#f97316" } },
                { x: kpi.avgSpeed * 1.4, y: 25, text: "卡關區", showarrow: false, font: { color: "#ef4444" } },
              ],

              legend: {
                orientation: "h",
                y: -0.35,
              },
            }}
            config={{
              responsive: true,
              displayModeBar: true,
            }}
            style={{ width: "100%", height: "100%" }}
          />
        </CardContent>
      </Card>


      </div>
    )}
      
        {/* ===== 詳細作答紀錄（逐題 × 作答次數） ===== */}
          {selectedMission !== "all" && (
            <Card>
              <CardHeader>
                <CardTitle>詳細作答紀錄</CardTitle>
                <CardDescription>
                  以題目為單位，呈現各次作答是否答對（✔ / ✘）
                </CardDescription>
              </CardHeader>

              <CardContent className="overflow-x-auto">
                <table className="min-w-full border border-slate-200 text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border px-3 py-2 text-left">題目</th>
                      {Array.from({ length: maxAttemptNo }).map((_, i) => (
                        <th key={i} className="border px-3 py-2 text-center">
                          第 {i + 1} 次作答
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {Object.entries(groupedByQuestion).map(([qid, attempts]) => (
                      <tr key={qid} className="hover:bg-slate-50">
                        <td className="border px-3 py-2 font-medium">
                          {qid}
                        </td>

                        {Array.from({ length: maxAttemptNo }).map((_, i) => {
                          const attempt = attempts.find(a => a.attempt_no === i + 1);

                          return (
                            <td
                              key={i}
                              className="border px-3 py-2 text-center"
                            >
                              {attempt ? (
                                attempt.result_success ? (
                                  <span className="text-green-600 text-lg">✔</span>
                                ) : (
                                  <span className="text-red-600 text-lg">✘</span>
                                )
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        
          
    </div>
  );
}


