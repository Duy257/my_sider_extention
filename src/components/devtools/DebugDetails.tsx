import { useState, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import type { CSSProperties } from "react";
import type { AiDevTrace } from "../../core/devtools/types";
import { DEV_COPY } from "../../core/devtools/copy";

// Ẩn khỏi màn hình nhưng vẫn để trình đọc màn hình đọc được.
// Dùng inline style vì component còn chạy trong shadow DOM của cửa sổ nổi (không có Tailwind).
const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0
};

// Khoảng cách tới đáy ô reasoning (px) vẫn được coi là "đang ở đáy"
const THINKING_STICK_THRESHOLD = 24;

type DebugDetailsProps = {
  trace: AiDevTrace;
  compact?: boolean;
};

export function DebugDetails({ trace, compact }: DebugDetailsProps) {
  const isStreamingReasoning = trace.thinking.state === "returned" && trace.status === "pending";
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStreamingRef = useRef(false);
  // true khi panel do hệ thống tự mở; người dùng bấm toggle thì không tự đóng nữa
  const autoExpandedRef = useRef(false);
  const thinkingRef = useRef<HTMLPreElement>(null);
  const thinkingStickRef = useRef(true);
  const [, forceTick] = useReducer((n: number) => n + 1, 0);

  // Tự mở khi reasoning bắt đầu stream; tự đóng khi trace kết thúc nếu panel do hệ thống mở
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = isStreamingReasoning;
    if (!wasStreaming && isStreamingReasoning) {
      autoExpandedRef.current = true;
      setExpanded(true);
    } else if (wasStreaming && !isStreamingReasoning && autoExpandedRef.current) {
      autoExpandedRef.current = false;
      setExpanded(false);
    }
  }, [isStreamingReasoning]);

  // Cập nhật thời gian đã chạy mỗi giây khi trace còn pending (không có delta nào làm re-render)
  useEffect(() => {
    if (trace.status !== "pending") return;
    const timer = setInterval(forceTick, 1000);
    return () => clearInterval(timer);
  }, [trace.status]);

  // Ô reasoning bám theo nội dung mới nếu người dùng chưa cuộn lên; chạy trước khi vẽ để không nháy
  useLayoutEffect(() => {
    const el = thinkingRef.current;
    if (el && isStreamingReasoning && thinkingStickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [trace.thinking.content, isStreamingReasoning, expanded]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!trace.thinking.content) return;
    try {
      await navigator.clipboard.writeText(trace.thinking.content);
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const getSummaryText = () => {
    const parts: string[] = [DEV_COPY.summaryPrefix];
    
    // Feature / Mode
    parts.push(trace.feature);
    parts.push(trace.requestedThinkingMode);

    // TTFT (Time to first token)
    if (trace.firstTokenAt) {
      parts.push(`${trace.firstTokenAt - trace.startedAt} ms TTFT`);
    }

    // Elapsed Duration
    const endTime = trace.finishedAt || Date.now();
    const elapsedSec = ((endTime - trace.startedAt) / 1000).toFixed(1);
    parts.push(`${elapsedSec} s`);

    // Tokens
    if (trace.usage?.totalTokens !== undefined) {
      parts.push(`${trace.usage.totalTokens} tok`);
    }

    return parts.join(" · ");
  };

  return (
    <section
      role="region"
      aria-label="AI dev trace"
      className={`mt-2 rounded-xl border border-stone-850 bg-stone-950 font-mono text-[11px] text-stone-400 ${compact ? "p-2" : "p-3"}`}
    >
      {/* Chỉ thông báo khi status đổi, không đọc từng đoạn reasoning mới */}
      <span style={VISUALLY_HIDDEN} aria-live="polite">
        {trace.status === "pending" ? "" : trace.status}
      </span>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`debug-details-${trace.requestId}`}
        onClick={() => {
          autoExpandedRef.current = false;
          setExpanded(!expanded);
        }}
        className="flex w-full items-center justify-between font-semibold tracking-wide text-stone-300 outline-none hover:text-violet-400 transition-colors cursor-pointer"
      >
        <span>{getSummaryText()}</span>
        <span className="text-[9px] text-stone-500">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div
          id={`debug-details-${trace.requestId}`}
          className="mt-3.5 space-y-3.5 border-t border-stone-900 pt-3"
        >
          {/* Request section */}
          <div>
            <h4 className="font-bold uppercase tracking-wider text-stone-500 text-[10px] mb-1.5">{DEV_COPY.request}</h4>
            <div className="space-y-0.5 text-stone-400 pl-2">
              <div>provider: <span className="text-stone-300">{trace.providerId}</span></div>
              <div>model: <span className="text-stone-300">{trace.model}</span></div>
              <div>thinkingMode: <span className="text-stone-300">{trace.requestedThinkingMode}</span></div>
              <div>
                <span>params:</span>
                <pre className="mt-1 max-h-40 overflow-auto rounded border border-stone-900 bg-stone-900/60 p-2 text-[10px] text-stone-300 font-mono">{JSON.stringify(trace.effectiveRequestParams, null, 2)}</pre>
              </div>
            </div>
          </div>

          {/* Thinking section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-bold uppercase tracking-wider text-stone-500 text-[10px]">{DEV_COPY.thinking}</h4>
              {trace.thinking.content && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold cursor-pointer outline-none"
                >
                  {copied ? DEV_COPY.copied : DEV_COPY.copyThinking}
                </button>
              )}
            </div>
            <div className="pl-2">
              {trace.thinking.state === "not-returned" || trace.thinking.state === "unsupported" ? (
                <div className="text-stone-500 italic">{DEV_COPY.thinkingNotReturned}</div>
              ) : trace.thinking.state === "pending" && !trace.thinking.content ? (
                <div className="text-stone-500 animate-pulse">...</div>
              ) : (
                <pre
                  ref={thinkingRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    thinkingStickRef.current =
                      el.scrollHeight - el.scrollTop - el.clientHeight < THINKING_STICK_THRESHOLD;
                  }}
                  className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded border border-stone-900 bg-stone-900/60 p-2 leading-relaxed text-stone-300 break-all font-mono"
                >
                  {trace.thinking.content}
                </pre>
              )}
            </div>
          </div>

          {/* Usage section */}
          <div>
            <h4 className="font-bold uppercase tracking-wider text-stone-500 text-[10px] mb-1.5">{DEV_COPY.usage}</h4>
            <div className="space-y-0.5 text-stone-400 pl-2">
              {trace.usage ? (
                <div>
                  input: <span className="text-stone-300 mr-4">{trace.usage.inputTokens ?? "N/A"}</span>
                  output: <span className="text-stone-300 mr-4">{trace.usage.outputTokens ?? "N/A"}</span>
                  total: <span className="text-stone-300">{trace.usage.totalTokens ?? "N/A"}</span>
                </div>
              ) : (
                <div className="text-stone-500 italic">{DEV_COPY.unavailableUsage}</div>
              )}
              {trace.finishReason && (
                <div>finish: <span className="text-stone-300">{trace.finishReason}</span></div>
              )}
              <div>status: <span className={`font-semibold ${
                trace.status === "success" ? "text-emerald-400" :
                trace.status === "pending" ? "text-amber-400" : "text-red-400"
              }`}>{trace.status}</span></div>
              {trace.error && (
                <div className="text-red-400 break-all mt-1 bg-red-950/20 border border-red-900/20 p-1.5 rounded">{trace.error}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
