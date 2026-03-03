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
    { id: "development_index", label: "練習診斷指標" },
    { id: "regional_gap", label: "區域學習差距" },
    { id: "gap_trend", label: "平均差距走勢" },
    { id: "practice_trend", label: "練習投入走勢" },
    { id: "effect_trend", label: "學習成效走勢" },
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
    <aside className="w-[320px] h-full bg-white border-l flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-5">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <Bot className="w-5 h-5 text-emerald-600" />
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
          <div className="text-slate-400 text-center mt-10">
            尚未產生 AI 分析
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className="border rounded-lg bg-slate-50"
          >
            <button
              onClick={() =>
                setMessages(prev =>
                  prev.map(m =>
                    m.id === msg.id
                      ? { ...m, collapsed: !m.collapsed }
                      : m
                  )
                )
              }
              className="w-full flex items-start justify-between p-3 gap-2"
            >
              <div className="flex items-start gap-2 text-left">
                {msg.status === "done" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                ) : (
                  <span className="animate-pulse text-slate-400">⏳</span>
                )}

                <div>
                  {msg.questions.length > 0 && (
                    <div className="font-medium text-slate-800">
                      【分析項目】<br />
                      {msg.questions.join("、")}
                    </div>
                  )}

                  <div className="text-xs text-slate-500 mt-1">
                    {msg.status === "loading"
                      ? "分析中…"
                      : "分析完成"}
                  </div>
                </div>
              </div>

              {msg.collapsed ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {!msg.collapsed && msg.content && (
              <div className="px-3 pb-3 text-slate-700 whitespace-pre-line">
                {msg.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}