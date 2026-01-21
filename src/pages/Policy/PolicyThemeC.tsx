// src/pages/StudentThemeC.tsx
import { useMemo } from "react";
import { useUserContext } from "@/contexts/UserContext";

const STRATEGY_LABEL: Record<string, string> = {
  stable_complete: "穩定完整觀看",
  active_regulated: "主動調整學習",
  fast_skimming: "快速瀏覽影片",
  struggling_rewatch: "卡關反覆理解",
  no_engagement: "低投入觀看",
  other: "多元混合學習",
  unknown: "尚無法判定",
};

export default function StudentThemeC() {
  const { filteredRows } = useUserContext();

  const history = useMemo(() => {
    const map = new Map<string, any>();

    filteredRows.forEach((r) => {
      const key = r.video_name;
      if (!map.has(key)) {
        map.set(key, {
          video_name: key,
          indicator_name: r.indicator_name,
          views: 1,
          totalCoverage: r.coverage_ratio,
          maxCoverage: r.coverage_ratio,
          strategy: r.learning_strategy_type,
        });
      } else {
        const v = map.get(key);
        v.views += 1;
        v.totalCoverage += r.coverage_ratio;
        v.maxCoverage = Math.max(v.maxCoverage, r.coverage_ratio);
      }
    });

    return Array.from(map.values());
  }, [filteredRows]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">
        學習歷程紀錄
      </h2>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-slate-500">
            <th className="text-left py-2">單元</th>
            <th className="text-left">影片</th>
            <th className="text-center">觀看次數</th>
            <th className="text-center">累積完成率</th>
            <th className="text-left">主要策略</th>
          </tr>
        </thead>

        <tbody>
          {history.map((v) => (
            <tr key={v.video_name} className="border-b">
              <td className="py-2">{v.indicator_name}</td>
              <td>{v.video_name}</td>
              <td className="text-center">{v.views}</td>
              <td className="text-center">
                {(Math.min(v.totalCoverage, 1) * 100).toFixed(1)}%
              </td>
              <td>{STRATEGY_LABEL[v.strategy]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
