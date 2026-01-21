// src/pages/StudentThemeB.tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "@/contexts/UserContext";
import { Card } from "@/components/ui/card";

export default function StudentThemeB() {
  const navigate = useNavigate();
  const { userSn, rows } = useUserContext();

  /* =========================
     1️⃣ 登入防呆
     ========================= */
  if (!userSn) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="mb-4">尚未登入學生帳號</p>
        <button
          onClick={() => navigate("/login")}
          className="text-blue-600 underline"
        >
          前往登入
        </button>
      </div>
    );
  }

  /* =========================
     2️⃣ 該學生資料
     ========================= */
  const studentRows = useMemo(() => {
    return rows.filter(
      (r) => String(r.user_sn) === String(userSn)
    );
  }, [rows, userSn]);

  /* =========================
     3️⃣ 弱點影片（影片層級）
     ========================= */
  const weakVideos = useMemo(() => {
    /**
     * 聚合結構：
     * video_name -> { indicator, totalCoverage, views }
     */
    const map = new Map<
      string,
      {
        video_name: string;
        indicator_name: string;
        views: number;
        totalCoverage: number;
      }
    >();

    for (const r of studentRows) {
      const key = r.video_name || "未命名影片";
      const cur = map.get(key);

      if (!cur) {
        map.set(key, {
          video_name: key,
          indicator_name: r.indicator_name,
          views: 1,
          totalCoverage: r.coverage_ratio,
        });
      } else {
        cur.views += 1;
        cur.totalCoverage += r.coverage_ratio;
      }
    }

    return Array.from(map.values())
      .map((v) => ({
        ...v,
        avgCoverage: v.views > 0 ? v.totalCoverage / v.views : 0,
      }))
      .filter((v) => v.avgCoverage < 0.5) // ⭐ 真正弱點
      .sort((a, b) => a.avgCoverage - b.avgCoverage)
      .slice(0, 10);
  }, [studentRows]);

  /* =========================
     4️⃣ Render
     ========================= */
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">
        錯題與學習弱點
      </h2>

      <p className="text-sm text-slate-500">
        以下為完成率偏低的影片（影片層級彙總），建議優先回顧
      </p>

      <div className="space-y-3">
        {weakVideos.map((v) => (
          <Card key={v.video_name} className="p-4">
            <div className="font-semibold truncate">
              {v.video_name}
            </div>

            <div className="text-sm text-slate-500">
              單元：{v.indicator_name}
            </div>

            <div className="text-sm text-rose-600 font-medium mt-1">
              平均完成率 {(v.avgCoverage * 100).toFixed(1)}%
            </div>

            <div className="text-xs text-slate-400 mt-1">
              觀看次數：{v.views} 次
            </div>
          </Card>
        ))}

        {weakVideos.length === 0 && (
          <div className="text-slate-400 text-sm">
            目前沒有明顯的學習弱點 🎉
          </div>
        )}
      </div>
    </div>
  );
}
