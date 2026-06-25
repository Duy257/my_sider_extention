import React, { useState } from "react";
import type { SavedResult } from "../../../src/lib/storage/types";

export function SavedResults(props: {
  results: SavedResult[];
  onDelete: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (props.results.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center animate-fade-in-up">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-stone-850">
          <svg className="h-6 w-6 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-xs text-stone-400">Chưa có kết quả nào.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3.5 p-3.5 animate-fade-in-up">
      <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Kết quả đã lưu</h2>
      
      {props.results.map((result) => {
        const isExpanded = expandedId === result.id;
        const textLength = result.outputMarkdown.length;
        const shouldShowToggle = textLength > 150;

        return (
          <article 
            key={result.id} 
            className="relative rounded-2xl border border-stone-850 bg-surface p-4 shadow-sm hover:border-stone-800 transition-all duration-300"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                className="flex-1 text-left text-sm font-semibold text-primary-light hover:brightness-110 transition-all leading-snug"
                onClick={() => setExpandedId(isExpanded ? null : result.id)}
              >
                {result.title || "Phản hồi không tiêu đề"}
              </button>
              <button
                className="flex-shrink-0 text-stone-500 hover:text-red-400 transition-colors p-1"
                title="Xóa"
                onClick={() => setConfirmDeleteId(result.id)}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>

            <div className="mt-2.5 text-[13px] leading-relaxed text-stone-300 whitespace-pre-wrap">
              {isExpanded ? (
                result.outputMarkdown
              ) : (
                <div className="line-clamp-3 text-stone-400">{result.outputMarkdown}</div>
              )}
            </div>

            <div className="mt-3.5 flex items-center justify-between border-t border-stone-850/40 pt-2.5">
              {shouldShowToggle ? (
                <button
                  className="text-xs font-semibold text-stone-400 hover:text-stone-200 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : result.id)}
                >
                  {isExpanded ? "Thu gọn" : "Xem thêm"}
                </button>
              ) : (
                <div />
              )}
              <time className="text-[10px] font-medium text-stone-500">
                {new Date(result.createdAt).toLocaleDateString("vi-VN", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>

            {/* Premium Confirm Delete Overlay */}
            {confirmDeleteId === result.id && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-warm-bg/95 backdrop-blur-sm animate-fade-in-up">
                <div className="text-center p-4">
                  <p className="mb-3 text-[13px] font-semibold text-stone-200">Bạn muốn xóa kết quả này?</p>
                  <div className="flex justify-center gap-2">
                    <button
                      className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-500 transition-all duration-200 active:scale-95 cursor-pointer"
                      onClick={() => {
                        props.onDelete(result.id);
                        setConfirmDeleteId(null);
                      }}
                    >
                      Xóa
                    </button>
                    <button
                      className="rounded-lg bg-surface border border-stone-800 px-3.5 py-1.5 text-xs font-bold text-stone-300 hover:bg-stone-800 transition-all duration-200 active:scale-95 cursor-pointer"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
