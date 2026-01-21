// src/pages/StudentThemeA.tsx
import { useMemo } from "react";
import { useUserContext } from "@/contexts/UserContext";

import { Card } from "@/components/ui/card";

const STRATEGY_LABEL: Record<string, string> = {
  stable_complete: "穩定完整觀看",
  active_regulated: "主動調整學習",
  fast_skimming: "快速瀏覽影片",
  struggling_rewatch: "卡關反覆理解",
  no_engagement: "低投入觀看",
  other: "多元混合學習",
  unknown: "尚無法判定",
};

export default function StudentThemeA() {
  const { rows, dateRange } = useUserContext();

  /* =========================
     KPI 計算（假設 rows 已是該學生）
     ========================= */
  const kpi = useMemo(() => {
    if (!rows || rows.length === 0) {
      return {
        totalDistinctVideos: 0,
        avgCoverage: 0,
        dominantStrategy: "unknown",
      };
    }

    const totalDistinctVideos = new Set(
      rows.map((r) => r.video_name)
    ).size;

    const avgCoverage =
      rows.reduce((s, r) => s + (Number(r.coverage_ratio) || 0), 0) /
      rows.length;

    const strategyCount: Record<string, number> = {};
    rows.forEach((r) => {
      const key = r.learning_strategy_type || "unknown";
      strategyCount[key] = (strategyCount[key] || 0) + 1;
    });

    const dominantStrategy =
      Object.entries(strategyCount).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "unknown";

    return {
      totalDistinctVideos,
      avgCoverage,
      dominantStrategy,
    };
  }, [rows]);

  /* =========================
     Render
     ========================= */
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">
        我的學習進度
      </h2>

      <p className="text-sm text-slate-500">
        分析期間：{dateRange.start || "—"} ～ {dateRange.end || "—"}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-slate-500">觀看影片數</div>
          <div className="text-3xl font-bold">
            {kpi.totalDistinctVideos}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-slate-500">平均完成率</div>
          <div className="text-3xl font-bold text-blue-600">
            {(kpi.avgCoverage * 100).toFixed(1)}%
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-slate-500">主要學習策略</div>
          <div className="text-xl font-semibold">
            {STRATEGY_LABEL[kpi.dominantStrategy]}
          </div>
        </Card>
      </div>
    </div>
  );
}
