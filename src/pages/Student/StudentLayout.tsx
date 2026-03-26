// src/pages/StudentLayout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import StudentAIPanel from "@/pages/Student/StudentAPanel";
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

  // 1. 新增一個 refreshKey 狀態
  const [refreshKey, setRefreshKey] = useState(0);

  // 2. 定義重整函數：每次點擊就讓 key 加 1
  const handleContentRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };


  /* =====================
     登入防呆
     ===================== */
  useEffect(() => {
    if (!userSn) {
      navigate("/login", { replace: true });
    }
  }, [userSn, navigate]);

  if (!userSn) return null;

  
  const ICON_SIZE = 18;

  return (
    <div className="flex h-screen w-full bg-[#f8fbfc] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">

        {/* =====================
           Top Header
           ===================== */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-6">

          {/* =====================
              Left: Logo & Version
          ===================== */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {/* Logo 圖示 (若需要可取消註釋)
              <div className="w-12 h-12 flex items-center justify-center">
                <img src={myLogo} alt="Logo" className="h-15 w-auto" />
              </div> 
              */}
              
              {/* Muti-Edu 點擊可重新整理頁面 */}
              <button 
                onClick={handleContentRefresh}
                className="text-2xl font-bold text-black tracking-tight hover:opacity-70 transition-opacity focus:outline-none"
              >
                Muti-Edu
              </button>
            </div>

            

              {/* 身份標籤 (包含 Tooltip 功能) */}
            <div className="relative ml-2 group"> 
              {/* 標籤主體 */}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 cursor-default">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                
                <span className="text-sm font-semibold text-blue-700"> 學生 </span>

              </div>
           
              {/* 下拉資訊卡 */}
              {userInfo && (
                <div className="absolute top-full mt-2 left-0 w-[380px]
                                invisible opacity-0 group-hover:visible group-hover:opacity-100
                                bg-[#ebf0ff] border rounded-lg shadow-xl
                                p-4 text-sm text-slate-700 z-50
                                transition-all duration-200 transform origin-top-left scale-95 group-hover:scale-100">
                  
                  {/* 資訊卡內容 */}
                  <div className="space-y-1 leading-relaxed">

                    <div className="font-semibold text-[12px] text-slate-800">
                      ID：{userInfo.user_id} <br/>
                      OpenID：{userInfo.OpenID_sub}
                    </div>

                    
                  </div>

                  {/* 小箭頭 (選用，增加視覺指引) */}
                  <div className="absolute -top-1.5 left-6 w-3 h-3 bg-[#ebf0ff] border-t border-l rotate-45"></div>
                </div>
              )}
            </div>

            <span className="px-1 text-base font-semibold text-blue-700 opacity-80">{userInfo.city}</span>
            <span className="text-base font-semibold text-blue-700 opacity-80">{userInfo.organization_id} 國小</span>
            <span className="text-base font-semibold text-blue-700 opacity-80">{userInfo.grade}年{userInfo.class}班</span>
              
                 {/* 使用者簡稱  
                <span className="text-sm text-sky-800 font-semibold">
                  {userSn}
                </span> */}

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

        {/* ===================== Page Content ===================== */}
        <main className="flex-1 overflow-y-auto p-4">
          <div key={refreshKey} className="h-full">
            <Outlet />
          </div>
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
