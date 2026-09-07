import { useCallback, useRef } from "react";
import { sanitizeHtml } from "../../../src/core/security/sanitize-html";
import type { SelectionInfo } from "../types";

type ReaderViewProps = {
  content: string;
  title: string;
  url: string;
  onSelection?: (info: SelectionInfo) => void;
  onDismissSelection?: () => void;
};

export type { ReaderViewProps };

export function ReaderView({ content, title, url, onSelection, onDismissSelection }: ReaderViewProps) {
  const articleRef = useRef<HTMLDivElement>(null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseUp = useCallback(() => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    selectionTimerRef.current = setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || text.length < 2 || !selection || selection.rangeCount === 0 || !onSelection) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect) return;

      onSelection({
        text,
        rect: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right, width: rect.width, height: rect.height },
      });
    }, 300);
  }, [onSelection]);

  const handleMouseDown = useCallback(() => {
    if (selectionTimerRef.current) {
      clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = null;
    }
    onDismissSelection?.();
  }, [onDismissSelection]);

  return (
    <article
      ref={articleRef}
      onMouseUp={handleMouseUp}
      onMouseDown={handleMouseDown}
      className="reader-article mx-auto max-w-[700px] px-6 py-16"
    >
      <header className="mb-10">
        <h1 className="text-2xl font-bold leading-tight text-stone-50">{title}</h1>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-primary-light hover:underline"
        >
          {url}
        </a>
      </header>
      <div
        className="prose-content text-[16px] leading-relaxed text-stone-200 space-y-5"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    </article>
  );
}
