import { useCallback, useEffect, useRef, useState } from "react";
import { AI_STREAM_PORT } from "../../../src/lib/messaging/ports";
import type { AiPortResponse } from "../../../src/lib/messaging/types";
import { buildUserChatMessages } from "../../../src/lib/prompts/builders";
import { MessageContent } from "../../../src/lib/ui/MessageContent";

type SummaryLength = "short" | "medium" | "detailed";

const SUMMARY_LABELS: Record<SummaryLength, string> = {
  short: "1 câu",
  medium: "1 đoạn",
  detailed: "Chi tiết",
};

const SUMMARY_INSTRUCTIONS: Record<SummaryLength, string> = {
  short: "Tóm tắt bài viết này trong MỘT CÂU ngắn gọn nhất.",
  medium: "Tóm tắt bài viết này trong MỘT ĐOẠN (3-5 câu), nêu ý chính.",
  detailed: "Tóm tắt chi tiết bài viết này. Gồm: điểm chính, luận cứ, kết luận.",
};

export function SummaryTab({
  pageContent,
  title,
  url,
}: {
  pageContent: string;
  title: string;
  url: string;
}) {
  const [length, setLength] = useState<SummaryLength>("short");
  const [summary, setSummary] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sections] = useState<string[]>(() => {
    const headingMatches = pageContent.match(/<h[12][^>]*>([^<]+)<\/h[12]>/gi);
    return headingMatches
      ? headingMatches.map((h) => h.replace(/<[^>]+>/g, "").trim()).slice(0, 10)
      : [];
  });
  const portRef = useRef<chrome.runtime.Port | null>(null);

  const generateSummary = useCallback((sectionContext?: string) => {
    if (streaming) return;
    setStreaming(true);
    setSummary("");

    const contentContext = sectionContext
      ? `Đoạn sau đây:\n"""\n${sectionContext}\n"""`
      : `Bài viết: "${title}"\nURL: ${url}\n\nNội dung:\n"""\n${pageContent}\n"""`;

    const userPrompt = `${SUMMARY_INSTRUCTIONS[length]}\n\n${contentContext}\n\nTrả lời bằng tiếng Việt.`;

    const requestId = crypto.randomUUID();
    const messages = buildUserChatMessages(userPrompt, []);

    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: AI_STREAM_PORT });
      portRef.current = port;
    } catch {
      setSummary("Không thể kết nối dịch vụ AI.");
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
        setSummary((prev) => prev + message.delta);
      }
      if (message.type === "AI_STREAM_DONE" || message.type === "AI_STREAM_ERROR") {
        setStreaming(false);
        port.disconnect();
        portRef.current = null;
      }
    });

    port.postMessage({ type: "AI_CHAT_REQUEST", requestId, messages });
  }, [length, pageContent, title, url, streaming]);

  useEffect(() => {
    return () => {
      try { portRef.current?.disconnect(); } catch {}
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 p-3.5">
      <div className="flex gap-1.5">
        {(Object.entries(SUMMARY_LABELS) as [SummaryLength, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
              length === key
                ? "bg-primary/20 text-primary-light border border-primary/30"
                : "text-stone-400 hover:text-stone-200 border border-stone-800 hover:border-stone-700"
            }`}
            onClick={() => setLength(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={() => generateSummary()}
        disabled={streaming}
        className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-dark transition-colors active:scale-95 disabled:opacity-50"
      >
        {streaming ? "Đang tóm tắt..." : "Tóm tắt toàn trang"}
      </button>



      {summary ? (
        <div className="rounded-xl border border-stone-850 bg-surface p-3.5 text-[13px] leading-relaxed">
          <MessageContent content={summary} />
          {streaming && <span className="animate-pulse text-stone-400">|</span>}
        </div>
      ) : streaming ? (
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <svg className="h-4 w-4 animate-spinner" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Đang kết nối...
        </div>
      ) : null}
    </div>
  );
}
