import { Outlet, NavLink, useNavigate, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import TeacherAIPanel from "@/pages/Teacher/TeacherAIPanel";
import { Avatar, AvatarImage, AvatarFallback, } from "@/components/ui/avatar";
import {
  SchoolIcon,
  BarChart3,
  Sparkles,
  Bot,
  LogOut,
} from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";

export default function TeacherLayout() {
  const navigate = useNavigate();
  // 1. 引入 isLoading
  const { userSn, role, userInfo, isLoading, logout } = useUserContext();

  const [aiOpen, setAiOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleContentRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  /* =====================
     登入與權限保護邏輯
     ===================== */
  
  // 2. 處理載入中：防止重新整理時 state 暫時為 null 導致被剔除
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f9f8fc]">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
          <span className="text-sm text-violet-600 font-medium">系統讀取中...</span>
        </div>
      </div>
    );
  }

  // 3. 確定載入完成後，判斷是否有權限
  // 如果沒登入，導向 /teacher/login (依照你的 App.tsx 路徑)
  if (!userSn || !userInfo || role !== "teacher") {
    return <Navigate to="/teacher/login" replace />;
  }

  const ICON_SIZE = 18;

  return (
    <div className="flex h-screen w-full bg-[#f9f8fc] overflow-hidden">
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
              <div className="flex items-center gap-1.5 px-3 py-1 bg-violet-500/10 rounded-full border border-violet-500/20 cursor-default">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-800"></span>
                
                <span className="text-sm font-semibold text-violet-800"> 教師 </span>

              </div>
            </div>

  
              <span className="text-base font-semibold text-violet-800 opacity-80">{userInfo.city}</span>
              <span className="text-base font-semibold text-violet-800 opacity-80">{userInfo.organization_id} 國小</span>
            
          </div>

          {/* =====================
             Right: Actions
             ===================== */}
          <div className="flex items-center gap-3">

            {/* AI Assistant */}
            <button
              onClick={() => setAiOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 text-sm
                        rounded-lg border text-violet-600 border-violet-200
                        hover:bg-violet-50 transition"
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
        <TeacherAIPanel onClose={() => setAiOpen(false)} />
      )}
    </div>
  );
}

        