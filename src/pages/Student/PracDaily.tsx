import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useUserContext } from "@/contexts/UserContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Activity, ArrowLeft } from "lucide-react";
import _ from "lodash";

/* =========================
   Types
   ========================= */

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
}

interface PracItemRow {
  prac_sn: number;
  indicator_name: string;
  item_index: number;
  is_correct: number;
  ans_time_ms: number;
}

/* =========================
   Main Component
   ========================= */

export default function PracDaily() {
  const { userSn } = useUserContext();
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [items, setItems] = useState<PracItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeIndicator, setActiveIndicator] = useState<string | null>(null);

  /* =========================
     Fetch Data
     ========================= */
  useEffect(() => {
    if (!userSn || !date) return;

    const fetchData = async () => {
      setLoading(true);

      const attemptsReq = supabase
        .from("dp001_prac_attempts")
        .select("*")
        .eq("user_sn", userSn)
        .eq("activity_date", date)
        .order("date", { ascending: true });

      const itemsReq = supabase
        .from("dp001_prac_items")
        .select("*")
        .eq("user_sn", userSn)
        .eq("activity_date", date)
        .order("item_index");

      const [aRes, iRes] = await Promise.all([attemptsReq, itemsReq]);

      setAttempts((aRes.data as AttemptRow[]) || []);
      setItems((iRes.data as PracItemRow[]) || []);
      setLoading(false);
    };

    fetchData();
  }, [userSn, date]);

  /* =========================
     Data Processing
     ========================= */

  const dailyKPI = useMemo(() => {
    if (!attempts.length) {
      return { count: 0, totalTime: 0, avgScore: 0 };
    }

    return {
      count: attempts.length,
      totalTime: Math.round(_.sumBy(attempts, "during_time") / 60),
      avgScore: Math.round(_.meanBy(attempts, "score_rate")),
    };
  }, [attempts]);

  const indicatorGroups = useMemo<Record<string, AttemptRow[]>>(() => {
    return _.groupBy(attempts, "indicator_name");
  }, [attempts]);

  const indicatorItems = useMemo(() => {
    if (!activeIndicator) return [];

    const pracSNs =
      indicatorGroups[activeIndicator]?.map((a) => a.prac_sn) || [];

    return items.filter(
      (i) =>
        i.indicator_name === activeIndicator &&
        pracSNs.includes(i.prac_sn)
    );
  }, [items, activeIndicator, indicatorGroups]);

  /* =========================
     Render
     ========================= */

  if (loading) {
    return (
      <div className="p-20 flex items-center justify-center text-slate-500">
        <Activity className="animate-spin mr-2" />
        載入每日練習資料中…
      </div>
    );
  }

  if (!date) {
    return <div className="p-10 text-slate-500">未指定日期</div>;
  }

  return (
    <div className="space-y-6 p-4">

      {/* ===== Back Button ===== */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        回上一層
      </button>


      {/* ===== LOD2：Daily Overview ===== */}
      <Card>
        <CardHeader>
          <CardTitle>{date} 練習狀況總覽</CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-slate-500">練習次數</p>
            <p className="text-2xl font-bold">{dailyKPI.count}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">總練習時間</p>
            <p className="text-2xl font-bold">{dailyKPI.totalTime} 分</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">平均正確率</p>
            <p className="text-2xl font-bold">{dailyKPI.avgScore}%</p>
          </div>
        </CardContent>
      </Card>

      {/* ===== LOD2：Indicator List ===== */}
      <Card>
        <CardHeader>
          <CardTitle>能力指標練習狀況</CardTitle>
          <CardDescription>
            點擊能力指標查看該指標的詳細作答紀錄
          </CardDescription>
        </CardHeader>

        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(indicatorGroups).map(([indicator, rows]) => {
            const avg = Math.round(_.meanBy(rows, "score_rate"));
            return (
              <div
                key={indicator}
                onClick={() => setActiveIndicator(indicator)}
                className={`cursor-pointer rounded-lg border p-4 transition
                  ${
                    activeIndicator === indicator
                      ? "border-blue-500 bg-blue-50"
                      : "hover:bg-slate-50"
                  }`}
              >
                <div className="font-medium">{indicator}</div>
                <div className="text-sm text-slate-500">
                  練習 {rows.length} 次｜平均正確率 {avg}%
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ===== LOD3：Indicator Detail ===== */}
      {activeIndicator && (
        <Card>
          <CardHeader>
            <CardTitle>能力指標細節：{activeIndicator}</CardTitle>
            <CardDescription>
              顯示該能力指標在此日期的題目作答結果
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">題號</th>
                    <th className="px-3 py-2 text-center">正確</th>
                    <th className="px-3 py-2 text-right">作答時間(ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {indicatorItems.map((i) => (
                    <tr
                      key={`${i.prac_sn}-${i.item_index}`}
                      className="border-t"
                    >
                      <td className="px-3 py-2">{i.item_index}</td>
                      <td className="px-3 py-2 text-center">
                        {i.is_correct ? (
                          <span className="text-green-600 font-bold">✔</span>
                        ) : (
                          <span className="text-red-600 font-bold">✘</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {Math.round(i.ans_time_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
