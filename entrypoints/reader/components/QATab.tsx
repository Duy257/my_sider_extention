import { useCallback, useRef, useState } from "react";
import { AI_STREAM_PORT } from "../../../src/lib/messaging/ports";
import type { AiPortResponse } from "../../../src/lib/messaging/types";
import { buildUserChatMessages } from "../../../src/lib/prompts/builders";

type QAMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const PRESET_QUESTIONS = [
  "Bài viết này nói về gì?",
  "Tác giả quan điểm gì?",
  "Điểm chính cần nhớ?",
];

export function QATab({ pageContent }: { pageContent: string }) {
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendQuestion = useCallback((question: string) => {
    if (!question.trim() || streaming) return;
    setStreaming(true);
    setInput("");

    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    const contextPrompt = `Dựa trên nội dung bài viết sau, hãy trả lời câu hỏi của tôi.\n\nNội dung bài viết:\n"""\n${pageContent}\n"""\n\nCâu hỏi: ${question}\n\nTrả lời bằng tiếng Việt.`;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: question },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    const messages = buildUserChatMessages(contextPrompt, []);

    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: AI_STREAM_PORT });
      portRef.current = port;
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "Không thể kết nối dịch vụ AI." } : m
        )
      );
      setStreaming(false);
      return;
    }

    port.onDisconnect.addListener(() => {
      setStreaming(false);
      portRef.current = null;
    });

    port.onMessage.addListener((message: AiPortResponse) => {
      if (message.requestId !== requestId) return;
      if (message.type === "AI_STREAM_CHUNK") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + message.delta } : m
          )
        );
        setTimeout(scrollToBottom, 50);
      }
      if (message.type === "AI_STREAM_DONE") {
        setStreaming(false);
        port.disconnect();
        portRef.current = null;
      }
      if (message.type === "AI_STREAM_ERROR") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Lỗi: ${message.message}` }
              : m
          )
        );
        setStreaming(false);
        port.disconnect();
        portRef.current = null;
      }
    });

    port.postMessage({ type: "AI_CHAT_REQUEST", requestId, messages });
  }, [pageContent, streaming]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto space-y-3 p-3.5">
        {messages.length === 0 && (
          <div className="flex flex-col gap-1.5 pt-2">
            <p className="text-xs text-stone-500 mb-2">Hỏi nhanh:</p>
            {PRESET_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => sendQuestion(q)}
                disabled={streaming}
                className="rounded-lg border border-stone-800 bg-surface px-3 py-2 text-left text-xs text-stone-400 hover:text-stone-200 hover:border-stone-700 transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
              msg.role === "user"
                ? "ml-4 bg-primary/20 text-stone-100 rounded-br-none"
                : "mr-4 bg-surface border border-stone-850 text-stone-300 rounded-bl-none"
            }`}
          >
            {msg.content || (msg.role === "assistant" && streaming && (
              <span className="inline-flex gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0s" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0.2s" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0.4s" }} />
              </span>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-stone-850 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendQuestion(input);
              }
            }}
            placeholder="Hỏi về nội dung..."
            disabled={streaming}
            className="flex-1 rounded-xl bg-warm-bg border border-stone-850 px-3 py-2 text-xs text-stone-200 placeholder-stone-500 focus:border-primary/80 focus:ring-1 focus:ring-primary/45 outline-none transition-all disabled:opacity-50"
          />
          <button
            onClick={() => sendQuestion(input)}
            disabled={!input.trim() || streaming}
            className="rounded-xl bg-primary px-3 py-2 text-white disabled:opacity-50 hover:bg-primary-dark transition-colors active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
