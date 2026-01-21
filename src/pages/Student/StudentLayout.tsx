// src/pages/StudentLayout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  Home,
  BarChart3,
  PenTool,
  PlayCircle,
  Calculator,
  Sparkles,
  Bell,
  LogOut,
} from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";

import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import studentAvatar from "@/assets/student-avatar.jpg";

export default function StudentLayout() {
  const navigate = useNavigate();
  const { userSn, organizationId, gradeId, classId } = useUserContext();

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
        <header className="h-16 bg-white border-b flex items-center justify-between px-6">

          {/* =====================
             Left: Home + Nav Tabs
             ===================== */}
          <div className="flex items-center gap-6">

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-5">
               {/* <TopTab
                to="/student"
                icon={<Home size={ICON_SIZE} />}
                label="首頁"
                end
              />  */}
              <TopTab
                to="/student/practice"
                icon={<BarChart3 size={ICON_SIZE} />}
                label="練習表現"
              />
              <TopTab
                to="/student/exam"
                icon={<PenTool size={ICON_SIZE} />}
                label="測驗答題"
              />
              <TopTab
                to="/student/math"
                icon={<Calculator size={ICON_SIZE} />}
                label="數學測驗"
              />
            </nav>
          </div>

          {/* =====================
             Right: Notification + Student Info
             ===================== */}
          <div className="flex items-center gap-4">

            {/* Student Avatar Card */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg">
              <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                <AvatarImage src={studentAvatar} alt="學生頭像" />
              </Avatar>
              <div className="leading-tight">
                <div className="text-m font-semibold text-gray-900">
                  學生 {userSn}
                </div>
                <div className="text-xs text-gray-500">
                  
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600"
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
    </div>
  );
}

/* =====================
   Top Tab Component
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

