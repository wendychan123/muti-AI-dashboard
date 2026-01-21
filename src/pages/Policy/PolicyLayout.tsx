// src/pages/StudentLayout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Sparkles, Home } from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";

export default function StudentLayout() {
  const navigate = useNavigate();
  const { userSn, role, userInfo } = useUserContext();

  /* =====================
     登入防呆（唯一一個）
     ===================== */
  useEffect(() => {
    if (!userSn) {
      navigate("/login", { replace: true });
    }
  }, [userSn, navigate]);

  // ⛔ 不要 loading，不要查 supabase
  if (!userSn || !userInfo) {
    return null; // 或 skeleton
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">

        {/* ===== Header ===== */}
        <header className="bg-white border-b px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">
            {role === "student" && "學生 "}
            {role === "teacher" && "教師 "}
            {role === "policy_maker" && "教育管理者 "}
            {userSn} 個人儀表板
          </h1>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border bg-white text-slate-600 hover:bg-slate-50">
              <Sparkles className="w-4 h-4" />
              AI 助手
            </button>

            <NavLink
              to="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border bg-white text-slate-600 hover:bg-slate-50"
            >
              <Home className="w-4 h-4" />
              回主畫面
            </NavLink>
          </div>
        </header>

        {/* ===== Tabs（之後可依 role 切換） ===== */}
        <nav className="bg-white border-b px-8">
          <div className="flex gap-6">
            <TopTab to="/student/theme-a" label="我的學習進度" />
            <TopTab to="/student/theme-b" label="錯題與弱點" />
            <TopTab to="/student/theme-c" label="學習歷程紀錄" />
          </div>
        </nav>

        {/* ===== Page Content ===== */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* =====================
   Tab Component
   ===================== */
function TopTab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
        py-3 px-1 text-sm font-medium transition-colors
        ${
          isActive
            ? "text-blue-600 border-b-2 border-blue-600"
            : "text-slate-500 hover:text-blue-600"
        }
        `
      }
    >
      {label}
    </NavLink>
  );
}
