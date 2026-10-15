import { useCallback, useRef, useState } from "react";
import { createAiTraceHandlers, useAiStream } from "../../../src/hooks/useAiStream";
import {
  buildSummaryMessages,
  type SummaryLength,
} from "../../../src/core/prompts/builders";
import { MessageContent } from "../../../src/components/chat/MessageContent.tsx";
import { DebugDetails } from "../../../src/components/devtools/DebugDetails";
import type { AiDevTrace } from "../../../src/core/devtools/types";
import { AI_DISCONNECTED_ERROR, CHAT_SETTINGS } from "../../../src/constants";

const SUMMARY_LABELS: Record<SummaryLength, string> = {
  short: "1 câu",
  medium: "1 đoạn",
  detailed: "Chi tiết",
};

export function SummaryTab({
  pageContent,
  title,
  url,
  devMode = false,
}: {
  pageContent: string;
  title: string;
  url: string;
  devMode?: boolean;
}) {
  const [length, setLength] = useState<SummaryLength>("short");
  const [summary, setSummary] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [trace, setTrace] = useState<AiDevTrace | undefined>(undefined);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const [sections] = useState<string[]>(() => {
    const headingMatches = pageContent.match(/<h[12][^>]*>([^<]+)<\/h[12]>/gi);
    return headingMatches
      ? headingMatches.map((h) => h.replace(/<[^>]+>/g, "").trim()).slice(0, 10)
      : [];
  });

  const { endTrace, ...traceHandlers } = createAiTraceHandlers(setTrace);

  const { start } = useAiStream(
    {
      ...traceHandlers,
      onChunk: (delta) => setSummary((prev) => prev + delta),
      onDone: (finalTrace) => {
        setStreaming(false);
        endTrace(finalTrace ? { trace: finalTrace } : { status: "success", now: Date.now() });
      },
      onError: (message, finalTrace) => {
        setSummary(message);
        setStreaming(false);
        endTrace(finalTrace ? { trace: finalTrace } : { error: message, status: "error", now: Date.now() });
      },
      onDisconnect: () => {
        setStreaming(false);
        const message = chrome.runtime.lastError?.message || AI_DISCONNECTED_ERROR;
        endTrace({ error: message, status: "interrupted", now: Date.now() });
      },
    },
    { flushMs: CHAT_SETTINGS.STREAM_FLUSH_MS },
  );

  const generateSummary = useCallback(
    (sectionContext?: string) => {
      if (streaming) return;
      setStreaming(true);
      setSummary("");
      setTrace(undefined);

      const requestId = crypto.randomUUID();
      const messages = buildSummaryMessages(
        { title, url, pageContent, sectionContext },
        length,
      );

      start({
        requestId,
        sessionId: sessionIdRef.current,
        messages,
        ...(devMode ? { devContext: { surface: "reader", feature: "reader-summary" } } : {}),
      });
    },
    [length, pageContent, title, url, streaming, start, devMode],
  );

  return (
    <div className="flex flex-col gap-3 p-3.5">
      <div className="flex gap-1.5">
        {(Object.entries(SUMMARY_LABELS) as [SummaryLength, string][]).map(
          ([key, label]) => (
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
          ),
        )}
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
          <svg
            className="h-4 w-4 animate-spinner"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              opacity="0.15"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          Đang kết nối...
        </div>
      ) : null}

      {trace && <DebugDetails trace={trace} compact />}
    </div>
  );
}
