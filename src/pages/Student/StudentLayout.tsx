// src/pages/StudentLayout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import StudentAIPanel from "@/components/StudentAiPanel";
import { Avatar, AvatarImage, AvatarFallback, } from "@/components/ui/avatar";
import studentAvatar from "@/assets/student-avatar.jpg";
import {
  BarChart3,
  Sparkles,
  Bot,
  LogOut,
} from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";

export default function StudentLayout() {
  const navigate = useNavigate();
  const { userSn, userInfo } = useUserContext();
  const [aiOpen, setAiOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);

  /* =====================
     登入防呆
     ===================== */
  useEffect(() => {
    if (!userSn) {
      navigate("/login", { replace: true });
    }
  }, [userSn, navigate]);

  if (!userSn) return null;

  /* =====================
     Icon size 統一控管
     ===================== */
  const ICON_SIZE = 18;

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">

        {/* =====================
           Top Header
           ===================== */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-6">

          {/* =====================
             Left: Title
             ===================== */}
          <div className="flex items-center gap-3">
            {/* <Avatar className="h-10 w-10 border-0 border-white shadow-sm"> <AvatarImage src={studentAvatar} alt="學生頭像" /> </Avatar> */}
            <div className="relative flex items-center gap-3">

              {/* 學生名稱按鈕 */}

              <span className="text-lg font-semibold text-slate-700">
                學生
              </span>

              <button
                onClick={() => setInfoOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5
                          bg-slate-100 hover:bg-slate-200
                          rounded-md text-sm font-medium 
                          transition"
              >
               {userSn}
              </button>

              <span className="text-lg font-semibold text-slate-700">
                學習儀表板
              </span>

              {/* 下拉資訊卡 */}
              {infoOpen && userInfo && (
                <div className="absolute top-12 left-0 w-80
                                bg-white border rounded-lg shadow-xl
                                p-4 text-sm text-slate-700 z-50">

                  <div className="space-y-1 leading-relaxed">
                    <div className="font-mono text-xs text-slate-500">
                      {userInfo.user_id}
                    </div>

                    <div className="font-mono text-s">
                      {userInfo.city} {userInfo.organization_id} 國小 <br/>
                      {userInfo.grade} 年 {userInfo.class} 班
                    </div>

                  </div>
                </div>
              )}
            </div>

          </div>

          {/* =====================
             Right: Actions
             ===================== */}
          <div className="flex items-center gap-3">

            {/* AI Assistant */}
            <button
              onClick={() => setAiOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 text-sm
                        rounded-lg border text-blue-600 border-blue-200
                        hover:bg-blue-50 transition"
            >
              <Bot className="w-4 h-4" />
              {aiOpen ? "收合 AI" : "開啟 AI"}
            </button>


            {/* Logout */}
            <button
              onClick={() => navigate("/")}
              className="
                flex items-center gap-2 px-4 py-2
                text-sm font-medium
                rounded-lg border
                text-slate-600 border-slate-200
                hover:bg-slate-100 transition
              "
            >
              <LogOut className="w-4 h-4" />
              登出
            </button>
          </div>
        </header>

        {/* =====================
           Page Content
           ===================== */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>

         {/* ===== 右側 AI Panel ===== */}
      {aiOpen && (
        <StudentAIPanel onClose={() => setAiOpen(false)} />
      )}
    </div>
  );
}

/* =====================
   Top Tab Component
   （目前保留，之後若要加分頁可用）
   ===================== */
function TopTab({
  to,
  label,
  icon,
  end = false,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `
        flex items-center gap-2 px-1 py-2 text-sm font-medium
        border-b-2 transition-colors
        ${
          isActive
            ? "text-blue-600 border-blue-600"
            : "text-slate-500 border-transparent hover:text-blue-600"
        }
        `
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
