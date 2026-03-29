import { useEffect, useState } from "react";
import {
  X,
  Bot,
  BarChart,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";

import type { PolicyExplainTarget } from "@/lib/ai/buildPolicyPracPrompt";

/* =========================
   Types
========================= */

interface AIEventPayload {
  questions?: string[];
  loading?: boolean;
  content?: string | null;
}

interface AIMessage {
  id: string;
  questions: string[];
  status: "loading" | "done";
  content?: string;
  collapsed: boolean;
  showDetail?: boolean;
}

/* =========================
   Component
========================= */

export default function PolicyAIPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [selectedCharts, setSelectedCharts] = useState<PolicyExplainTarget[]>([]);
  const [toolOpen, setToolOpen] = useState(true);

  /* =========================
     圖表選項（強型別）
  ========================= */

  const chartOptions: {
    id: PolicyExplainTarget;
    label: string;
  }[] = [
    { id: "policy_overview", label: "總覽練習概況" },
    { id: "development_index", label: "練習診斷指標" },
    { id: "regional_gap", label: "區域學習差距" },
    { id: "gap_trend", label: "區域成效對標" },
    { id: "practice_trend", label: "練習時間走勢" },
    { id: "effect_trend", label: "學習成效走勢" },
    { id: "school_matrix", label: "學校落點分佈" },
    { id: "scissors_gap", label: "校際差距走勢" },
  ];

  /* =========================
     監聽 AI 回傳（單圖 / 多圖共用）
  ========================= */

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AIEventPayload>).detail;
      if (!detail) return;

      setMessages(prev => {
        // Loading → 新增一筆
        if (detail.loading === true) {
          const newMessage: AIMessage = {
            id: crypto.randomUUID(),
            questions: detail.questions || [],
            status: "loading",
            collapsed: false,
          };

          return [
            newMessage,
            ...prev.map(m => ({ ...m, collapsed: true })),
          ];
        }

        // 完成 → 更新第一筆 loading
        if (detail.loading === false) {
          const index = prev.findIndex(m => m.status === "loading");
          if (index === -1) return prev;

          return prev.map((m, i) =>
            i === index
              ? {
                  ...m,
                  status: "done",
                  content: detail.content || "",
                }
              : m
          );
        }

        return prev;
      });
    };

    window.addEventListener("policy-ai-update", handler);
    return () =>
      window.removeEventListener("policy-ai-update", handler);
  }, []);

  /* =========================
     詳細內容處理
  ========================= */
  const toggleDetail = (id: string) => {
    setMessages(prev =>
      prev.map(m => (m.id === id ? { ...m, showDetail: !m.showDetail } : m))
    );
  };

  /* =========================
     多圖整合分析
  ========================= */

  const handleAnalysis = () => {
    if (selectedCharts.length === 0) return;

    window.dispatchEvent(
      new CustomEvent("policy-ai-multi-request", {
        detail: {
          charts: selectedCharts,
        },
      })
    );

    // 分析後清空勾選
    setSelectedCharts([]);

    // 分析後自動收合工具區
    setToolOpen(true);
  };

  /* =========================
     UI
  ========================= */

  return (
    <aside className="w-[300px] h-full bg-white border-l flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-5">
        <div className="flex items-center justify-center gap-2 font-semibold text-slate-800 w-full">
          AI 決策助手
        </div>
        <button onClick={onClose}>
          <X className="w-5 h-5 text-slate-500 hover:text-slate-800" />
        </button>
      </div>

      {/* 分析工具區 */}
      <div className="px-4">
        <div className="border rounded-lg bg-emerald-50 text-xs">

          {/* 標題列 */}
          <button
            onClick={() => setToolOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-3 py-3"
          >
            <div className="flex items-center gap-1 text-sm font-bold text-emerald-700">
              <BarChart className="w-4 h-4 text-emerald-600" />
              選擇要分析的圖表
              {selectedCharts.length > 0 && (
                <span className="ml-2 text-xs font-normal">
                  （已選 {selectedCharts.length} 項）
                </span>
              )}
            </div>

            {toolOpen ? (
              <ChevronUp className="w-4 h-4 text-emerald-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-emerald-600" />
            )}
          </button>

          {/* 勾選區 */}
          {toolOpen && (
            <div className="px-3 pb-3 space-y-2">
              {chartOptions.map(option => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                    checked={selectedCharts.includes(option.id)}
                    onChange={() =>
                      setSelectedCharts(prev =>
                        prev.includes(option.id)
                          ? prev.filter(c => c !== option.id)
                          : [...prev, option.id]
                      )
                    }
                  />
                  {option.label}
                </label>
              ))}

              <button
                onClick={handleAnalysis}
                disabled={selectedCharts.length === 0}
                className={`w-full mt-2 py-1 rounded text-white transition ${
                  selectedCharts.length === 0
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                開始分析
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 訊息區 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <Bot className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-xs">請勾選圖表（可複選）</p>
            <p className="text-xs">或點擊圖表旁的機器人圖示</p>
            <p className="text-xs">開始分析</p>
          </div>
        )}

        {messages.map(msg => {
          // 🔹 解析結構化回覆
          const parts = msg.content?.split("===詳細分析===") || [];
          const summary = parts[0]?.replace("｜快讀總結", "").trim() || "";
          const details = parts[1]?.trim() || "";

          return (
            <div key={msg.id} className="border rounded-lg bg-white overflow-hidden shadow-sm">
              {/* Header: 分析項目 */}
              <button
                onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, collapsed: !m.collapsed } : m))}
                className="w-full flex items-start justify-between p-3 gap-2 bg-slate-50/50 border-b border-slate-100"
              >
                <div className="flex items-start gap-2 text-left">
                  {msg.status === "done" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                  ) : (
                    <span className="animate-pulse text-slate-400">⏳</span>
                  )}
                  <div>
                    {msg.questions.length > 0 && (
                      <div className="font-bold text-slate-800 text-[12px] ">
                        分析：{msg.questions.map(q => q).join("、")}
                      </div>
                    )}
                  </div>
                </div>
                {msg.collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
              </button>

              {/* Body */}
              {!msg.collapsed && msg.content && (
                <div className="p-4">
                  {/* 🔹 1. 決策摘要：只要沒折疊 (collapsed=false)，這部分就應該永遠存在 */}
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-slate-700 leading-relaxed text-[13px] font-medium">
                    <div className="text-[13px] font-bold text-emerald-600 mb-1 uppercase tracking-widest">
                      決策建議摘要
                    </div>
                    {/* 修正點：確保即使沒有詳細內容標記，也能顯示完整內容 */}
                    {summary || msg.content}
                  </div>

                  {/* 🔹 2. 詳細內容控制區 */}
                  {details && (
                    <div className="mt-3">
                      {!msg.showDetail ? (
                        // 狀態 A：詳細內容被收起來了，顯示「查看」按鈕
                        <button
                          onClick={() => toggleDetail(msg.id)}
                          className="w-full py-2 text-xs text-emerald-600 hover:bg-emerald-50 rounded border border-dashed border-emerald-200 font-medium transition-colors"
                        >
                          查看詳細分析 ↓
                        </button>
                      ) : (
                        // 狀態 B：詳細內容展開中
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                          <div className="text-slate-600 text-[12px] leading-relaxed whitespace-pre-line border-t border-slate-100 pt-3 mt-1">
                            {details}
                          </div>
                          {/* 🔹 關鍵修正：點擊這個按鈕只會讓 showDetail 變回 false，摘要依然會在上面 */}
                          <button
                            onClick={() => toggleDetail(msg.id)}
                            className="py-2 text-[12px] text-emerald-500 hover:text-emerald-700 flex items-center justify-center w-full font-medium"
                          >
                            隱藏詳細內容 ↑
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}