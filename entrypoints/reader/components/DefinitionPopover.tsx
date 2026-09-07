import { useEffect, useRef, useState } from "react";
import { fetchCompletion } from "../../../src/core/ai/client";
import { resolveProviderRuntimeConfig } from "../../../src/core/ai/runtime";
import { getSettings } from "../../../src/core/storage";
import type { SelectionInfo } from "../types";

type DefinitionPopoverProps = {
  selection: SelectionInfo | null;
  onAskMore: (text: string) => void;
  onDismiss: () => void;
};

export function DefinitionPopover({ selection, onAskMore, onDismiss }: DefinitionPopoverProps) {
  const [definition, setDefinition] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cacheRef = useRef<Map<string, string>>(new Map());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selection) {
      setDefinition("");
      setError("");
      return;
    }

    const cached = cacheRef.current.get(selection.text);
    if (cached) {
      setDefinition(cached);
      return;
    }

    const abortController = new AbortController();
    setLoading(true);
    setError("");

    getSettings().then((settings) => {
      if (abortController.signal.aborted) return;
      const runtime = resolveProviderRuntimeConfig(settings);
      if (!runtime.ok) {
        setError(runtime.error);
        setLoading(false);
        return;
      }

      fetchCompletion({
        baseUrl: runtime.config.baseUrl,
        apiKey: runtime.config.apiKey,
        model: runtime.config.model,
        messages: [
          { role: "system", content: "Bạn là trợ lý giải thích. Giải thích ngắn gọn (1-3 câu) khái niệm sau bằng tiếng Việt. Chỉ trả lời phần giải thích, không thêm gì khác." },
          { role: "user", content: `Giải thích: ${selection.text}` },
        ],
        signal: abortController.signal,
        sessionId: crypto.randomUUID(),
      }).then((result) => {
        if (abortController.signal.aborted) return;
        setLoading(false);
        if (result.ok) {
          setDefinition(result.content);
          cacheRef.current.set(selection.text, result.content);
        } else {
          setError(result.error);
        }
      });
    });

    return () => {
      abortController.abort();
    };
  }, [selection]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    if (selection) {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [selection, onDismiss]);

  if (!selection) return null;

  const popoverStyle: React.CSSProperties = {
    position: "fixed",
    top: selection.rect.bottom + 8,
    left: Math.max(8, Math.min(selection.rect.left + selection.rect.width / 2 - 150, window.innerWidth - 308)),
    zIndex: 1000,
  };

  return (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="w-[300px] animate-fade-in-up rounded-xl border border-stone-800 bg-surface p-3.5 shadow-xl"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
        {selection.text}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Đang tra cứu...
        </div>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-stone-200">{definition}</p>
          <button
            onClick={() => onAskMore(selection.text)}
            className="mt-2 text-xs font-semibold text-primary-light hover:text-primary transition-colors"
          >
            Hỏi thêm →
          </button>
        </>
      )}
    </div>
  );
}
