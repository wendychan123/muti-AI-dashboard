import { useEffect, useState } from "react";
import {
  X,
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";

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

export default function PolicyAIPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<AIMessage[]>([]);

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

  return (
    <aside className="w-[320px] h-full bg-white border-l flex flex-col shadow-sm">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-5 border-b">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <Bot className="w-5 h-5 text-emerald-600" />
          AI 決策助手
        </div>
        <button onClick={onClose}>
          <X className="w-5 h-5 text-slate-500 hover:text-slate-800" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {messages.length === 0 && (
          <div className="text-slate-400 text-center mt-10">
            尚未產生 AI 分析
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} 
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
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                ) : (
                  <span className="animate-pulse text-slate-400">⏳</span>
                )}

                <div>
                  {msg.questions.length > 0 && (
                    <div className="font-medium text-slate-800">
                      分析項目：{msg.questions.join("、")}
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