import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import { supabase } from "@/lib/supabase";
import { useUserContext } from "@/contexts/UserContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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


/* =========================
   Types
========================= */
interface MathDailyRow {
  user_sn: number;
  activity_date: string;
  d_problem_count: number;
  d_correct_count: number;
  d_wrong_count: number;
  d_score_rate: number;
  d_total_time_sec: number;
}

/* =========================
   Component
========================= */
export default function StudentMath() {
  const { userSn } = useUserContext();
  const [rows, setRows] = useState<MathDailyRow[]>([]);
  const [loading, setLoading] = useState(true);


  /* =========================
     Fetch data
  ========================= */
  useEffect(() => {
    if (!userSn) return;

    const fetchData = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("dp003_math_daily")
        .select("*")
        .eq("user_sn", userSn)
        .order("activity_date", { ascending: true });

      if (error) {
        console.error(error);
      }

      setRows((data as MathDailyRow[]) || []);
      setLoading(false);
    };

    fetchData();
  }, [userSn]);

  /* =========================
     KPI calculation
  ========================= */
  const kpi = useMemo(() => {
    if (!rows.length) {
      return {
        totalProblems: 0,
        totalMinutes: 0,
        avgScore: 0,
      };
    }

    const totalProblems = rows.reduce(
      (sum, r) => sum + r.d_problem_count,
      0
    );

    const totalCorrect = rows.reduce(
      (sum, r) => sum + r.d_correct_count,
      0
    );

    const totalTimeSec = rows.reduce(
      (sum, r) => sum + r.d_total_time_sec,
      0
    );

    return {
      totalProblems,
      totalMinutes: Math.round(totalTimeSec / 60),
      avgScore: Math.round((totalCorrect / totalProblems) * 100),
    };
  }, [rows]);

  /* =========================
     Chart data
  ========================= */
  const dates = rows.map(r => r.activity_date);
  const correct = rows.map(r => r.d_correct_count);
  const wrong = rows.map(r => r.d_wrong_count);
  const minutes = rows.map(r => r.d_total_time_sec / 60);
  const totals = correct.map((c, i) => c + wrong[i]);


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

    {/* ===== 有資料才顯示整張 Card ===== */}
    {hasData && (
      <Card className="p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            每日數學測驗表現
          </h3>
        </div>

        {/* Chart */}
        <Plot
         data={[
            {
               x: dates,
               y: correct,
               type: "bar",
               name: "答對題數",
               marker: { color: "#60a5fa", opacity: 0.7  },
               text: correct,
               textposition: "inside",
               textfont: { color: "white", size: 12 },
            },
            {
               x: dates,
               y: wrong,
               type: "bar",
               name: "答錯題數",
               marker: { color: "#f97316", width: 3},
               text: wrong,
               textposition: "inside",
               textfont: { color: "white", size: 12 },
            },
            {
               x: dates,
               y: minutes,
               type: "scatter",
               mode: "lines+markers",
               name: "闖關時間（分鐘）",
               yaxis: "y2",
               line: { color: "#10b981", width: 3 },
               marker: { size: 7 },
            },
         ]}
         layout={{
            autosize: true,
            height: 250,
            margin: { t: 30, l: 50, r: 50, b: 90 },

            barmode: "stack",

            xaxis: {
               title: "日期",
               type: "category",
               tickangle: -30,
            },

            yaxis: {
               title: "題數",
               gridcolor: "#f1f5f9",
            },

            yaxis2: {
               title: "時間（分鐘）",
               overlaying: "y",
               side: "right",
               showgrid: false,
            },

            annotations: dates.map((date, i) => ({
               x: date,
               y: totals[i],
               text: `${totals[i]}`,
               showarrow: false,
               yanchor: "bottom",
               font: {
               size: 13,
               color: "#2563eb", 
               weight: "bold",
               },
            })),

            legend: {
               orientation: "h",
               y: -0.35,
            },

            font: { family: "inherit" },
         }}
         config={{ responsive: true }}
         useResizeHandler
         style={{ width: "100%", height: "100%" }}
         />


        {/* KPI */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-slate-500">總練習題數</p>
            <p className="text-2xl font-bold text-indigo-600">
              {kpi.totalProblems}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">總花費時間</p>
            <p className="text-2xl font-bold text-indigo-600">
              {kpi.totalMinutes} 分
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">平均正確率</p>
            <p className="text-2xl font-bold text-indigo-600">
              {kpi.avgScore}%
            </p>
          </div>
        </div>

      </Card>
    )}
  </div>
);

}


