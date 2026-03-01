// src/pages/Policy/PolicyLayout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
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



  return (
    <div className="flex h-screen w-full bg-[#f4fafb] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">

        {/* =====================
           Top Header
           ===================== */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-6">

          {/* =====================
             Left: Title
           ===================== */}
          <div className="relative flex items-center gap-3">

            <span className="text-lg font-semibold text-slate-700">
              教育管理者儀表板
            </span>

          </div>

          {/* =====================
             Right: Actions
           ===================== */}
          <div className="flex items-center gap-3">

            {/* AI Assistant */}
            <button
              onClick={() => setAiOpen(v => !v)}
              className="flex items-center gap-2 px-4 py-2 text-sm
                        rounded-lg border text-indigo-600 border-indigo-200
                        hover:bg-indigo-50 transition"
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
              返回首頁
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
        <PolicyAIPanel onClose={() => setAiOpen(false)} />
      )}
    </div>
  );
}
