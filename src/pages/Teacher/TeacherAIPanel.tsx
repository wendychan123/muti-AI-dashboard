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
  duration?: string;
}

interface AIMessage {
  id: string;
  questions: string[];
  status: "loading" | "done" | "error"; 
  content?: string;
  duration?: string;
  collapsed: boolean;
  showDetail?: boolean;
}


/* =========================
   Component
========================= */

export default function TeacherAIPanel({
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

  /* **文字** 並換成 Tailwind  */
  const formatText = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => {
      // 判斷這一行是不是標題 (通常 AI 產生的標題會以 emoji 或 ｜ 開頭)
      const isHeader = /^[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|｜/.test(line.trim());

      const parts = line.split(/(\*\*.*?\*\*)/g);

      return (
        <span key={lineIndex} className="block">
          {parts.map((part, partIndex) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              const innerText = part.slice(2, -2);
              
              if (isHeader) {
                return <span key={partIndex} className="font-bold text-red-700">{innerText}</span>;
              }
              
              return (
                <span key={partIndex} className="text-red-700 font-extrabold px-0.5">
                  {innerText}
                </span>
              );
            }
            return <span key={partIndex}>{part}</span>;
          })}
        </span>
      );
    });
  };

  /* =========================
     可選圖表
  ========================= */

  const chartOptions = [
    { id: "teacher_overview", label: "總覽練習表現" },
    { id: "practice_trend", label: "練習時間走勢" },
    { id: "performance_trend", label: "正確率走勢" },
    { id: "diagnostic", label: "教學診斷指標" },
    //{ id: "indicator_treemap", label: "知識節點熱力圖" },
    { id: "student_risk", label: "高風險學生與弱點知識節點" },
  ];


  /* =========================
     監聽 teacher-ai-update
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
              showDetail: false,  // 預設不顯示詳細
            },
            ...prev.map(m => ({ ...m, collapsed: true })),
          ];
        }

        // 完成 → 更新最新 loading
        if (detail.loading === false && detail.content) {
          const index = prev.findIndex(m => m.status === "loading");
          if (index === -1) return prev;

          return prev.map((m, i) =>
            i === index
              ? {
                  ...m,
                  status: "done",
                  content: detail.content,
                  duration: detail.duration,
                }
              : m
          );
        }

        return prev;
      });
    };

    window.addEventListener("teacher-ai-update", handler);
    return () =>
      window.removeEventListener("teacher-ai-update", handler);
  }, []);

  /* =========================
     詳細內容
  ========================= */

  const toggleDetail = (id: string) => {
    setMessages(prev =>
      prev.map(m => (m.id === id ? { ...m, showDetail: !m.showDetail } : m))
    );
  };

  /* =========================
     多圖分析觸發
  ========================= */

  const handleAnalysis = () => {
    if (selectedCharts.length === 0) return;

    window.dispatchEvent(
      new CustomEvent("teacher-ai-multi-request", {
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
    <aside className="w-[300px] h-full bg-white border-l flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-5 ">
        <div className="flex items-center justify-center gap-2 font-semibold text-slate-800 w-full">
          AI 教學助手
        </div>
        <button onClick={onClose}>
          <X className="w-5 h-5 text-slate-500 hover:text-slate-800" />
        </button>
      </div>

      {/* 分析工具（可收合） */}
      <div className="px-4">
        <div className="border rounded-lg bg-violet-50 text-xs">

          {/* Header（可點擊收合） */}
          <button
            onClick={() => setToolOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-3 py-3"
          >
            <div className="flex items-center gap-1 text-xs font-bold text-violet-700">
              <BarChart className="w-4 h-4 text-violet-600" />
              選擇要分析的圖表
              {selectedCharts.length > 0 && (
                <span className="ml-2 text-xs text-violet-600 font-normal">
                  （已選 {selectedCharts.length} 項）
                </span>
              )}
            </div>

            {toolOpen ? (
              <ChevronUp className="w-4 h-4 text-violet-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-violet-600" />
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
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 accent-violet-600 cursor-pointer"
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
                    : "bg-violet-600 hover:bg-violet-700"
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

        {messages.map(msg => {
          // 關鍵解析邏輯
          const parts = msg.content?.split("===詳細分析===") || [];
          // 去除標籤字眼，只留純文字內容
          const summary = parts[0]?.replace("｜快讀總結", "").trim() || "";
          const details = parts[1]?.trim() || "";

          return (
            <div key={msg.id} className="border rounded-lg bg-white overflow-hidden shadow-sm">
              {/* Header: 分析項目標題 */}
              <button
                onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, collapsed: !m.collapsed } : m))}
                className="w-full flex items-start justify-between p-3 gap-2 bg-slate-50/50 border-b border-slate-100"
              >
                <div className="flex items-start gap-2 text-left">
                  {msg.status === "done" ? (
                    <CheckCircle2 className="w-4 h-4 text-violet-600 mt-0.5" />
                  ) : (
                    <span className="animate-pulse text-slate-400">⏳</span>
                  )}
                  <div>
                    {msg.questions.length > 0 && (
                      <div className="font-bold text-slate-800 text-[12px]">
                        分析：{msg.questions.join("、")}
                      </div>
                    )}
                    <div className="text-[11px] mt-0.5 font-medium transition-colors duration-300">
                      {msg.status === "done" ? (
                        <span className="text-slate-400">
                          分析完畢 {msg.duration ? `(耗時 ${msg.duration} 秒)` : ""}
                        </span>
                      ) : (
                        <span className="text-violet-500 animate-pulse">
                          分析中...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-1">
                  {msg.collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {/* Body: 內容區 */}
              {!msg.collapsed && msg.content && (
                <div className="p-4">
                  {/* 簡短總結 */}
                  <div className="bg-violet-50 p-3 rounded-lg border-violet-500 text-slate-700 leading-relaxed text-[13px] font-medium">
                    <div className="text-[13px] font-bold text-violet-600 mb-1 uppercase tracking-widest">
                      教學建議摘要
                    </div>
                    {formatText(summary || msg.content)}
                  </div>

                  {/* 詳細內容 (Details) - 點擊才展開 */}
                  {details && (
                    <div className="mt-3">
                      {!msg.showDetail ? (
                        <button
                          onClick={() => toggleDetail(msg.id)}
                          className="w-full py-2 text-xs text-violet-600 hover:bg-violet-50 rounded border border-dashed border-violet-200 font-medium transition-colors"
                        >
                          展開詳細內容 ↓
                        </button>
                      ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                          <div className="text-slate-600 text-xs leading-relaxed whitespace-pre-line border-t pt-3 mt-1">
                            
                            {formatText(details)}
                          </div>
                          <button
                            onClick={() => toggleDetail(msg.id)}
                            className="text-[12px] text-violet-500 hover:text-violet-800 flex items-center justify-center w-full"
                          >
                            收起詳細分析 ↑
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