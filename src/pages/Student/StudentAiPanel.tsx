import { useEffect, useState } from "react";
import {
  X,
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  BarChart,
} from "lucide-react";

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

export default function StudentAiPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  /* =========================
     State
  ========================= */

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [selectedCharts, setSelectedCharts] = useState<string[]>([]);
  const [toolOpen, setToolOpen] = useState(true);

  /* =========================
     可選圖表
  ========================= */

  const chartOptions = [
    { id: "總覽", label: "練習狀況表現" },
    { id: "投入走勢", label: "練習投入走勢" }, 
    { id: "成效走勢", label: "學習成效走勢" },
    { id: "投入", label: "能力指標投入" },
    { id: "歷程", label: "學習歷程表現" },
    { id: "差距", label: "能力指標差距" },
  ];

  /* =========================
     監聽 student-ai-update
     （唯一訊息來源）
  ========================= */

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AIEventPayload>).detail;
      if (!detail) return;

      setMessages(prev => {
        // Loading → 新增一筆
        if (detail.loading) {
          return [
            {
              id: crypto.randomUUID(),
              questions: detail.questions || [],
              status: "loading",
              collapsed: false,
            },
            ...prev.map(m => ({ ...m, collapsed: true })),
          ];
        }

        // 🔹 完成 → 更新最新 loading
        if (detail.loading === false && detail.content) {
          const index = prev.findIndex(m => m.status === "loading");
          if (index === -1) return prev;

          return prev.map((m, i) =>
            i === index
              ? {
                  ...m,
                  status: "done",
                  content: detail.content,
                }
              : m
          );
        }

        return prev;
      });
    };

    window.addEventListener("student-ai-update", handler);
    return () =>
      window.removeEventListener("student-ai-update", handler);
  }, []);

  /* =========================
     多圖分析觸發
  ========================= */

  const handleAnalysis = () => {
    if (selectedCharts.length === 0) return;

    window.dispatchEvent(
      new CustomEvent("student-ai-multi-request", {
        detail: {
          charts: selectedCharts,
        },
      })
    );

    // 分析後清空勾選
    setSelectedCharts([]);
  };

  /* =========================
     UI
  ========================= */

  return (
    <aside className="w-[320px] h-full bg-white border-l flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-5 ">
        <div className="flex items-center justify-center gap-2 font-semibold text-slate-800 w-full">
         AI 學習助手
        </div>
        <button onClick={onClose}>
          <X className="w-5 h-5 text-slate-500 hover:text-slate-800" />
        </button>
      </div>

      {/* 分析工具（可收合） */}
      <div className="px-4">
        <div className="border rounded-lg bg-blue-50 text-xs">

          {/* Header（可點擊收合） */}
          <button
            onClick={() => setToolOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-3 py-3"
          >
            <div className="flex items-center gap-1 text-xs font-bold text-blue-700">
              <BarChart className="w-4 h-4 text-blue-600" />
              選擇要分析的圖表
              {selectedCharts.length > 0 && (
                <span className="ml-2 text-xs text-blue-600 font-normal">
                  （已選 {selectedCharts.length} 項）
                </span>
              )}
            </div>

            {toolOpen ? (
              <ChevronUp className="w-4 h-4 text-blue-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-blue-600" />
            )}
          </button>

          {/* Content */}
          {toolOpen && (
            <div className="px-3 pb-3 space-y-2">

              {chartOptions.map(option => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                    checked={selectedCharts.includes(option.label)}
                    onChange={() =>
                      setSelectedCharts(prev =>
                        prev.includes(option.label)
                          ? prev.filter(c => c !== option.label)
                          : [...prev, option.label]
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
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                開始分析
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 訊息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <Bot className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-xs">請勾選圖表（可複選）</p>
            <p className="text-xs">或點擊圖表旁的機器人圖示</p>
            <p className="text-xs">開始分析</p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className="border rounded-lg bg-slate-50"
          >
            {/* Header */}
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
                  <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5" />
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

            {/* Body */}
            {!msg.collapsed && msg.content && (
              <div className="px-4 pb-3 text-slate-700 whitespace-pre-line">
                {msg.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}