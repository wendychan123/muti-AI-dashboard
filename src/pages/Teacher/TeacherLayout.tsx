// src/pages/Teacher/TeacherLayout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Sparkles, Home } from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";

export default function TeacherLayout() {
  const navigate = useNavigate();
  const { userSn, role, userInfo } = useUserContext();

  /* =====================
     登入 & 角色防呆（只做一次）
     ===================== */
  useEffect(() => {
    if (!userSn) {
      navigate("/login", { replace: true });
      return;
    }

    if (role !== "teacher") {
      navigate("/", { replace: true });
    }
  }, [userSn, role, navigate]);

  // 尚未初始化完成時不 render（避免閃爍）
  if (!userSn || !userInfo || role !== "teacher") {
    return null;
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">

        {/* ===== Header ===== */}
        <header className="bg-white border-b px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">
            教師 {userSn} 班級儀表板
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

        {/* ===== Tabs（教師視角） ===== */}
        <nav className="bg-white border-b px-8">
          <div className="flex gap-6">
            <TopTab to="/teacher/theme-a" label="班級學習概覽" />
            <TopTab to="/teacher/theme-b" label="學生差異分析" />
            <TopTab to="/teacher/theme-c" label="學習歷程紀錄" />
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
