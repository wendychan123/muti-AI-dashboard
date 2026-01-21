import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import { supabase } from "@/lib/supabase";
import { useUserContext } from "@/contexts/UserContext";
import { Card } from "@/components/ui/card";
import { Calendar, BarChart2, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";

/* =========================
   Types
   ========================= */

interface PlatformEventRow {
  user_sn: string;
  platform: "dp001" | "dp002" | "dp003";
  event_date: string; // yyyy-mm-dd
  activity_count: number;
}

interface PracDailyRow {
  user_sn: string;
  activity_date: string; 
  d_prac_count: number;
  d_learn_time_sec: number;
  d_avg_score_rate: number;
  d_avg_efficiency: number;
  d_total_wrong: number;
}


interface ExamDailyRow {
  user_sn: string;
  attempt_date: string; 
  attempt_count: number;
  avg_accuracy: number; 
  avg_response_time: number; 
  total_duration_sec: number;
}




/* =========================
   Component
   ========================= */
export default function StudentOverview() {
  const navigate = useNavigate();
  const { userSn } = useUserContext();

  const [dailyRows, setDailyRows] = useState<PracDailyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 真正生效的日期區間（用來篩資料）
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // UI 暫存（讓使用者可以先選，再按「套用」）
  const [tempRange, setTempRange] = useState({ start: "", end: "" });

  // baseline = 該使用者「完整資料期間」（重置要回到這裡）
  const [baseline, setBaseline] = useState({ start: "", end: "" });

  const [platformEvents, setPlatformEvents] = useState<PlatformEventRow[]>([]);
  const [examDaily, setExamDaily] = useState<ExamDailyRow[]>([]);


  /* =========================
     Supabase: dp001_prac_daily
     ========================= */
  useEffect(() => {
    if (!userSn) return;

    const fetchDaily = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("dp001_prac_daily")
        .select("*")
        .eq("user_sn", userSn)
        .order("activity_date", { ascending: true });

      const rows = !error ? (data as PracDailyRow[]) : [];
      setDailyRows(rows);

      // 初始化 baseline / dateRange / tempRange
      if (rows.length > 0) {
        const dates = rows.map((r) => r.activity_date).sort();
        const start = dates[0];
        const end = dates[dates.length - 1];

        const base = {
          start: "2024-01-01",
          end: "2024-05-31",
        };

        setBaseline(base);
        setDateRange(base);
        setTempRange(base);

      } else {
        setBaseline({ start: "", end: "" });
        setDateRange({ start: "", end: "" });
        setTempRange({ start: "", end: "" });
      }

      setLoading(false);
    };

    fetchDaily();
  }, [userSn]);

  /* =========================
   Supabase: platform_view
   ========================= */
  useEffect(() => {
    if (!userSn) return;

    const fetchPlatformEvents = async () => {
      const { data, error } = await supabase
        .from("platform_view_summary")
        .select("user_sn, platform, event_date, activity_count")
        .eq("user_sn", userSn)
        .order("event_date", { ascending: true });

      if (!error && data) {
        setPlatformEvents(data as PlatformEventRow[]);
      }
    };

    fetchPlatformEvents();
  }, [userSn]);

  /* =========================
   Supabase: exam_view
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
     日期篩選
     ========================= */
  
  /* Prac view */
  const filteredDailyRows = useMemo(() => {
    const { start, end } = dateRange;

    return dailyRows.filter((r) => {
      const d = r.activity_date;

      // start/end 可能是空字串
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [dailyRows, dateRange]);

  //* Platform view */
  const filteredPlatformEvents = useMemo(() => {
    const { start, end } = dateRange;

    return platformEvents.filter(r => {
      if (start && r.event_date < start) return false;
      if (end && r.event_date > end) return false;
      return true;
    });
  }, [platformEvents, dateRange]);

  const platformLineData = useMemo(() => {
  const start = "2024-01-01";
  const end = "2024-05-30";

  // 產生完整日期序列
  const allDates = generateDateRange(start, end);

  // 建立 date → 平台次數 對照表
  const byDate: Record<
    string,
    { dp001: number; dp002: number; dp003: number }
  > = {};

  allDates.forEach((d) => {
    byDate[d] = { dp001: 0, dp002: 0, dp003: 0 };
  });

  // 填入實際資料
  filteredPlatformEvents.forEach((r) => {
    const platformKey = r.platform.trim().toLowerCase() as
      | "dp001"
      | "dp002"
      | "dp003";

    if (byDate[r.event_date]) {
      byDate[r.event_date][platformKey] += r.activity_count ?? 1;
    }
  });

  return {
    dates: allDates,
    dp001: allDates.map((d) => byDate[d].dp001),
    dp002: allDates.map((d) => byDate[d].dp002),
    dp003: allDates.map((d) => byDate[d].dp003),
  };
}, [filteredPlatformEvents]);

//* Exam view */
const filteredExamDaily = useMemo(() => {
  const { start, end } = dateRange;

  return examDaily.filter(r => {
    if (start && r.attempt_date < start) return false;
    if (end && r.attempt_date > end) return false;
    return true;
  });
}, [examDaily, dateRange]);



  /* =========================
     KPI Cards
     ========================= */

  /* Prac */
  const practice_kpi = useMemo(() => {
    if (!filteredDailyRows.length) {
      return { totalPrac: 0, totalTimeMin: 0, avgScore: 0 };
    }

    return {
      totalPrac: filteredDailyRows.reduce((s, r) => s + r.d_prac_count, 0),
      totalTimeMin: Math.round(
        filteredDailyRows.reduce((s, r) => s + r.d_learn_time_sec, 0) / 60
      ),
      avgScore: Math.round(
        filteredDailyRows.reduce((s, r) => s + r.d_avg_score_rate, 0) /
          filteredDailyRows.length
      ),
    };
  }, [filteredDailyRows]);

  /* Platform */
  const yMax = useMemo(() => {
    const timeValues = filteredDailyRows.map((r) => r.d_learn_time_sec / 60);
    return timeValues.length > 0 ? Math.max(...timeValues) * 1.1 : 100;
  }, [filteredDailyRows]);

  /* Exam */
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
     Render
     ========================= */
  if (!userSn) {
    return <div className="p-8 text-center text-slate-500">尚未登入</div>;
  }

  if (loading) {
    return <div className="p-8 text-center flex items-center justify-center h-screen text-slate-500"><Activity className="animate-spin mr-2"/> 分析資料載入中...</div>;
  }

  if (dailyRows.length === 0) {
    return <div className="p-8 text-center text-slate-500">尚無練習資料</div>;
  }

  return (
    <div className="space-y-6">
      {/* =========================
         Header + Date Filter
         ========================= */}
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <h2 className="text-2xl font-bold text-slate-800">學習總覽</h2>

        <div className="flex items-center gap-2 md:ml-auto">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">時間範圍：</span>

          <Input
            type="date"
            value={tempRange.start}
            onChange={(e) =>
              setTempRange((prev) => ({ ...prev, start: e.target.value }))
            }
            className="w-36 h-9"
          />
          <span className="text-slate-400">至</span>
          <Input
            type="date"
            value={tempRange.end}
            onChange={(e) =>
              setTempRange((prev) => ({ ...prev, end: e.target.value }))
            }
            className="w-36 h-9"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setDateRange(tempRange)}
            className="bg-slate-800 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-slate-900 transition-colors"
          >
            套用日期篩選
          </button>

          <button
            onClick={() => {
              setDateRange(baseline);
              setTempRange(baseline);
            }}
            className="text-slate-500 text-sm underline hover:text-slate-800 px-2"
          >
            重置日期
          </button>
        </div>
      </div>

      {/* =========================
         Cards
         ========================= */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        {/* ===== Platform Overview Card ===== */}
        <Card className="p-6 space-y-2 w-full md:col-span-1">
        <h3 className="text-lg font-bold text-slate-800">
          各平台學習瀏覽趨勢
        </h3>

        <Plot
          data={[
            {
              x: platformLineData.dates,
              y: platformLineData.dp001,
              type: "scatter",
              mode: "lines+markers",
              name: "dp001",
              line: { color: "#3b82f6", width: 3 },
              hovertemplate:
                "<b>dp001</b><br>" +
                "日期：%{x}<br>" +
                "瀏覽次數：%{y}<extra></extra>",
            },

            {
              x: platformLineData.dates,
              y: platformLineData.dp002,
              type: "scatter",
              mode: "lines+markers",
              name: "dp002",
              line: { color: "#10b981", width: 3 },
              hovertemplate:
                "<b>dp002</b><br>" +
                "日期：%{x}<br>" +
                "瀏覽次數：%{y}<extra></extra>",

            },
            {
              x: platformLineData.dates,
              y: platformLineData.dp003,
              type: "scatter",
              mode: "lines+markers",
              name: "dp003",
              line: { color: "#f59e0b", width: 3 },
              hovertemplate:
                "<b>dp003</b><br>" +
                "日期：%{x}<br>" +
                "瀏覽次數：%{y}<extra></extra>",

            },
          ]}
          useResizeHandler   
          style={{ width: "100%" }}   
          layout={{
            autosize: true,
            height: 350,
            margin: { t: 10, l: 30, r: 20, b: 60 },
            xaxis: {
              title: "日期",
              type: "category",
              tickangle: -40,
              tickfont: { size: 11 },
              tickformat: "%Y-%m-%d",
              nticks: 100, 
            },
            yaxis: {
              title: "瀏覽次數（對數尺度）",
              type: "symlog",
              tickmode: "auto",
              gridcolor: "#f1f5f9",
              zeroline: true,
            },

            legend: {
              orientation: "h",
              y: -0.4,
            },
          }}
          config={{ responsive: true, displayModeBar: true }}
        />
      </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ===== Practice Overview Card ===== */}
        <Card className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">練習表現 (dp001) </h3>
            

            <button
              onClick={() => navigate("/student/practice")}
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
              title="查看全部"
            >
              <BarChart2 size={20} />
            </button>
          </div>

          {/* Plot */}
          <div className="w-full overflow-hidden">
            <Plot
              data={[
                {
                  x: filteredDailyRows.map((r) => r.activity_date),
                  y: filteredDailyRows.map((r) => r.d_learn_time_sec / 60),
                  type: "bar",
                  name: "練習時間（分鐘）",
                  marker: { color: "#60a5fa", opacity: 0.65 },
                  cliponaxis: false,
                  hovertemplate:
                  "日期：%{x}<br>" +
                  "練習時間：%{y:.1f} 分鐘<extra></extra>",

                },
                {
                x: filteredDailyRows.map((r) => r.activity_date),
                y: filteredDailyRows.map((r) => r.d_avg_score_rate),
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
                height: 250,
                margin: { t: 20, l: 40, r: 40, b: 60 },
                xaxis: {
                  type: "category",
                  tickmode: "array",
                  tickvals: filteredDailyRows.map(r => r.activity_date),
                  ticktext: filteredDailyRows.map(r => r.activity_date),
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
              config={{ responsive: true, displayModeBar: false }}
              onClick={(e) => {
                if (!e.points?.length) return;
                const date = e.points[0].x as string;

                navigate("/student/practice", {
                  state: { activity_date: date, dateRange }, 
                });
              }}
            />
          </div>

          {/* KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-slate-500">總練習次數</p>
              <p className="text-2xl font-bold text-blue-600">
                {practice_kpi.totalPrac}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">總練習時間</p>
              <p className="text-2xl font-bold text-blue-600">
                {practice_kpi.totalTimeMin} 分
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">平均正確率</p>
              <p className="text-2xl font-bold text-blue-600">
                {practice_kpi.avgScore}%
              </p>
            </div>
          </div>

          {/* 空資料提示（篩完後可能會 0 筆） */}
          {filteredDailyRows.length === 0 && (
            <div className="text-center text-sm text-slate-500 pt-2">
              此日期區間沒有練習紀錄
            </div>
          )}
        </Card>


           {/* ===== Exam Overview Card ===== */}
          <Card className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">測驗表現（dp002） </h3>

            <button
              onClick={() => navigate("/student/exam")}
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
              title="查看全部"
            >
              <BarChart2 size={20} />
            </button>
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

            {/* 空資料提示（篩完後可能會 0 筆） */}
          {filteredExamDaily.length === 0 && (
            <div className="text-center text-sm text-slate-500 pt-2">
              該學生在此平台沒有學習紀錄
            </div>
          )}
          </Card>
      </div>
    </div>
  );
}
