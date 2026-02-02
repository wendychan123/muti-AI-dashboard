import { useEffect, useState } from "react";
import { X, Sparkles, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";

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

export default function StudentAiPanel({
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
        // 如果是 loading → 新增一筆
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

        // 如果是完成 → 更新最新一筆
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

  return (
    <aside className="w-[320px] h-full bg-white border-l flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-5">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <Sparkles className="w-5 h-5 text-blue-600" />
          AI 學習助手
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
          <div
            key={msg.id}
            className="border rounded-lg bg-slate-50"
          >
            {/* Message Header */}
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
                  {/* <div className="font-medium text-slate-800">
                    練習表現分析
                  </div> */}

                  {/* 使用者選擇 */}
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

            {/* Message Body */}
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