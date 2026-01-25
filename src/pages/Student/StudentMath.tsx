import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { supabase } from "@/lib/supabase";
import { useUserContext } from "@/contexts/UserContext";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity } from "lucide-react";

/* =========================
   Types
========================= */
interface MathDailyRow {
  activity_date: string;
  d_problem_count: number;
  d_correct_count: number;
  d_wrong_count: number;
  d_total_time_sec: number;
}

interface DailyUnitRow {
  activity_date: string;
  unit_name: string;
  du_problem_count: number;
  du_correct_count: number;
  du_wrong_count: number;
  du_avg_time_ms: number;
}

interface UnitDetail {
  unit_name: string;
  correct: number;
  wrong: number;
  avg_time_sec: number;
}

interface ItemRow {
  activity_date: string;
  answer_problem_num: string;
  is_correct: number;
  ans_time_ms: number;
  game_grade: string;
  game_time: number;
}

/* =========================
   Component
========================= */
export default function StudentMath() {
  const { userSn } = useUserContext();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MathDailyRow[]>([]);
  const [dailyUnitRows, setDailyUnitRows] = useState<DailyUnitRow[]>([]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  const [unitDetail, setUnitDetail] = useState<UnitDetail | null>(null);

  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [itemFilter, setItemFilter] =
    useState<"all" | "wrong" | "correct">("all");
  const [itemLoading, setItemLoading] = useState(false);

  /* =========================
     Fetch: Daily summary
  ========================= */
  useEffect(() => {
    if (!userSn) return;

    const run = async () => {
      setLoading(true);

      const { data } = await supabase
        .from("dp003_math_daily")
        .select("*")
        .eq("user_sn", userSn)
        .order("activity_date");

      setRows(data || []);
      setLoading(false);
    };

    run();
  }, [userSn]);

  /* =========================
     Fetch: All daily-unit (for pie)
  ========================= */
  useEffect(() => {
    if (!userSn) return;

    supabase
      .from("dp003_math_daily_unit_summary")
      .select("*")
      .eq("user_sn", userSn)
      .then(({ data }) => setDailyUnitRows(data || []));
  }, [userSn]);

  /* =========================
     Pie data (overall / daily)
  ========================= */
  const pieData = useMemo(() => {
    const source = selectedDate
      ? dailyUnitRows.filter(d => d.activity_date === selectedDate)
      : dailyUnitRows;

    const map: Record<string, number> = {};
    source.forEach(d => {
      map[d.unit_name] = (map[d.unit_name] || 0) + d.du_problem_count;
    });

    return {
      title: selectedDate
        ? `${selectedDate}｜數學闖關單元分佈`
        : "整體數學闖關單元分佈",
      labels: Object.entries(map).map(
        ([u, c]) => `${u}（${c} 題）`
      ),
      values: Object.values(map),
    };
  }, [selectedDate, dailyUnitRows]);

  /* =========================
     Click: Unit (pie)
  ========================= */
  const handleUnitClick = async (unitName: string) => {
    setSelectedUnit(unitName);

    // 單元表現
    const unitRow = dailyUnitRows.find(
      d =>
        d.unit_name === unitName &&
        (!selectedDate || d.activity_date === selectedDate)
    );

    if (unitRow) {
      setUnitDetail({
        unit_name: unitName,
        correct: unitRow.du_correct_count,
        wrong: unitRow.du_wrong_count,
        avg_time_sec: Math.round(unitRow.du_avg_time_ms / 1000),
      });
    }

    // 題目明細
    setItemLoading(true);

    let q = supabase
      .from("dp003_math_items")
      .select("*")
      .eq("user_sn", userSn)
      .eq("unit_name", unitName);

    if (selectedDate) q = q.eq("activity_date", selectedDate);
    if (itemFilter === "wrong") q = q.eq("is_correct", 0);
    if (itemFilter === "correct") q = q.eq("is_correct", 1);

    const { data } = await q.order("activity_date", { ascending: false });

    setItemRows(data || []);
    setItemLoading(false);
  };

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
     Render
  ========================= */
  if (loading)
    return (
      <div className="h-screen flex items-center justify-center text-slate-500">
        <Activity className="animate-spin mr-2" />
        資料載入中…
      </div>
    );

  const hasData = rows.length > 0;


  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== 無資料：只顯示提示，不顯示 Card ===== */}
        {!hasData && (
          <div className="flex flex-col items-center justify-center h-[300px] text-slate-500 space-y-5">
            <div className="text-2xl font-medium">
              該學生在此平台沒有學習紀錄
            </div>
          </div>
        )}

      {/* ===== 每日數學測驗表現 ===== */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-800">
            每日數學測驗表現
          </h3>
        <Plot
          data={[
            {
              x: rows.map(r => r.activity_date),
              y: rows.map(r => r.d_correct_count),
              type: "bar",
              name: "答對題數",
              marker: { color: "#60a5fa", opacity: 0.7  },
              text: rows.map(r => r.d_correct_count),
              textposition: "inside",
              textfont: { color: "white", size: 12 },

            },
            {
              x: rows.map(r => r.activity_date),
              y: rows.map(r => r.d_wrong_count),
              type: "bar",
              name: "答錯題數",
              marker: { color: "#f97316", width: 3},
              text: rows.map(r => r.d_wrong_count),
              textposition: "inside",
              textfont: { color: "white", size: 12 },

            },
          ]}
          layout={{ 
            barmode: "stack", 
            height: 260,
            margin: { t: 30, l: 50, r: 50, b: 90 },
            xaxis: {
               title: "日期",
               type: "category",
               tickangle: -20,
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
            legend: {
               orientation: "h",
               y: -0.35,
            },

            font: { family: "inherit" },
         }}
          onClick={e => {
            if (!e.points?.length) return;
            setSelectedDate(e.points[0].x as string);
            setSelectedUnit(null);
            setUnitDetail(null);
            setItemRows([]);
          }}
          config={{ responsive: false }}
          useResizeHandler
          style={{ width: "100%"}}
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

      {/* ===== 單元分佈 ===== */}
      <Card className="p-6">
        <h3 className="font-bold mb-3">{pieData.title}</h3>
        <Plot
          data={[
            {
              type: "pie",
              labels: pieData.labels,
              values: pieData.values,
              hole: 0.4,
            },
          ]}
          layout={{
            autosize: true,
            showlegend: true,
            margin: { t: 10, b: 30 },
            font: { family: "inherit" },
          }}
          onClick={e => {
            if (!e.points?.length) return;
            const unit = (e.points[0].label as string).split("（")[0];
            handleUnitClick(unit);
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </Card>
      </div>

      {/* ===== 單元表現 ===== */}
      {unitDetail && (
        <Card className="p-6">
          <h3 className="text-md font-bold text-slate-800 mb-4">
            單元表現 ｜ {unitDetail.unit_name}
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-lg bg-blue-50 p-4">
          <p className="text-sm text-slate-500">答對題數</p>
          <p className="text-2xl font-bold text-blue-600">
            {unitDetail.correct}
          </p>
        </div>

        <div className="rounded-lg bg-orange-50 p-4">
          <p className="text-sm text-slate-500">答錯題數</p>
          <p className="text-2xl font-bold text-orange-600">
            {unitDetail.wrong}
          </p>
        </div>

        <div className="rounded-lg bg-emerald-50 p-4">
          <p className="text-sm text-slate-500">平均作答時間</p>
          <p className="text-2xl font-bold text-emerald-600">
            {unitDetail.avg_time_sec} 秒
          </p>
        </div>
      </div>

        </Card>
      )}

      {/* ===== 題目作答明細 ===== */}
      {selectedUnit && (
        <Card className="p-6">
          <div className="flex justify-between mb-3">
            <h3 className="font-bold">題目作答明細 ｜ {selectedUnit}</h3>
            <Select
              value={itemFilter}
              onValueChange={v => {
                setItemFilter(v as any);
                handleUnitClick(selectedUnit);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="correct">只看答錯</SelectItem>
                <SelectItem value="wrong">只看答對</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {itemLoading ? (
            <div className="text-center text-slate-400">載入中…</div>
          ) : (
            <table className="w-full text-sm">
               <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">練習日期</th>
                  <th className="px-3 py-2 text-left">練習題目</th>
                  <th className="px-3 py-2 text-left">作答結果</th>
                  <th className="px-3 py-2 text-left">作答時間</th>
                  <th className="px-3 py-2 text-left">適用年級</th>
                </tr>
              </thead>

              <tbody>
                {itemRows.map((r, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-2">{r.activity_date}</td>
                    <td className="px-3 py-2">{r.answer_problem_num}</td>
                    <td className="px-8 py-2">{r.is_correct ? "✔" : "✘"}</td>
                    <td className="px-5 py-2">{Math.round(r.game_time / 1000)} 秒</td>
                    <td className="px-8 py-2">{r.game_grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}

