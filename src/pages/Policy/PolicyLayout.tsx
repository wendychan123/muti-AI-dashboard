// src/pages/Policy/PolicyLayout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import PolicyIP from "@/assets/PolicyIP.png";
import PolicyAIPanel from "@/pages/Policy/PolicyAIPanel"; 
import {
  Bot,
  LogOut,
  ShieldCheck,
} from "lucide-react";

export default function PolicyLayout() {
  const navigate = useNavigate();

  const [aiOpen, setAiOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);

  // 1. 新增一個 refreshKey 狀態
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCity, setSelectedCity] = useState("全部縣市");

  // 👉 3. 補上這段：打包要傳給子元件的 context
  const contextValue = useMemo(() => ({
    selectedCity,
    setSelectedCity
  }), [selectedCity]);

  // 2. 定義重整函數：每次點擊就讓 key 加 1
  const handleContentRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };


  



  return (
    <div className="flex h-screen w-full bg-[#f4fafb] overflow-hidden">
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
              
              {/* Multi-Edu 點擊可重新整理頁面 */}
              <button 
                onClick={handleContentRefresh}
                className="text-2xl font-bold text-black tracking-tight hover:opacity-70 transition-opacity focus:outline-none"
              >
                Multi-Edu
              </button>
            </div>

            {/* 身份標籤  */}
            <div className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
              {/* 小圓點 */}
              <span className="w-1.5 h-1.5 rounded-full bg-green-800"></span>
              
              <span className="text-sm font-semibold text-green-800">
                {selectedCity} 教育管理員
              </span>
            </div>
          </div>

          {/* =====================
             Right: Actions
           ===================== */}
          <div className="flex items-center gap-3">

            {/* AI Assistant */}
            <button
              onClick={() => setAiOpen(v => !v)}
              className="flex items-center gap-2 px-4 py-2 text-sm
                        rounded-lg border text-emerald-600 border-emerald-300
                        hover:bg-emerald-50 transition"
            >
              <Bot className="w-4 h-4" />
              {aiOpen ? "收合 AI" : "開啟 AI"}
            </button>

            {/* 返回首頁 */}
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
        <main className="flex-1 overflow-y-auto p-6">
          <div key={refreshKey} className="h-full">
            <Outlet context={contextValue} />
          </div>
        </main>
      </div>

      {/* ===== 右側 AI Panel ===== */}
      {aiOpen && (
        <PolicyAIPanel onClose={() => setAiOpen(false)} />
      )}
    </div>
  );
}
