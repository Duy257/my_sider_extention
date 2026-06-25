import React, { useState } from "react";
import type { PromptTemplate } from "../../../src/lib/prompts/types";

export function PromptManager(props: {
  prompts: PromptTemplate[];
  onChange: (prompts: PromptTemplate[]) => void;
}) {
  function updatePrompt(id: string, instruction: string) {
    props.onChange(
      props.prompts.map((prompt) =>
        prompt.id === id ? { ...prompt, instruction, updatedAt: new Date().toISOString() } : prompt
      )
    );
  }

  function addPrompt() {
    const now = new Date().toISOString();
    props.onChange([
      ...props.prompts,
      {
        id: crypto.randomUUID(),
        name: "Mẫu lệnh tùy chỉnh",
        instruction: "Phân tích nội dung này và đưa ra đề xuất thực tế súc tích.",
        category: "custom",
        sortOrder: props.prompts.length,
        createdAt: now,
        updatedAt: now
      }
    ]);
  }

  function deletePrompt(id: string) {
    props.onChange(props.prompts.filter((prompt) => prompt.id !== id));
  }

  return (
    <section className="space-y-4 p-3.5 animate-fade-in-up">
      <div className="flex justify-between items-center">
        <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Danh sách mẫu lệnh</h2>
        <button
          className="flex items-center gap-1.5 rounded-full bg-primary hover:bg-primary-dark px-4 py-2 text-xs font-bold text-white transition-all duration-300 shadow-md shadow-primary/10 active:scale-95 cursor-pointer"
          onClick={addPrompt}
        >
          <span>+</span> Thêm mẫu lệnh
        </button>
      </div>

      <div className="space-y-3">
        {props.prompts.map((prompt) => (
          <article 
            key={prompt.id} 
            className="group relative rounded-2xl border border-stone-850 bg-surface p-4 shadow-sm hover:border-stone-800 transition-all duration-300"
          >
            <button
              className="absolute right-3 top-3.5 text-stone-500 hover:text-red-400 transition-colors p-1"
              title="Xóa"
              onClick={() => deletePrompt(prompt.id)}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
            
            <div className="mb-2.5 text-[13px] font-semibold text-primary-light flex items-center gap-1.5">
              <svg className="h-4 w-4 text-primary-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {prompt.name}
            </div>

            <textarea
              className="min-h-[84px] w-full resize-none rounded-xl border border-stone-850 bg-warm-bg p-3 text-[13px] text-stone-100 placeholder-stone-600 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/45 transition-colors shadow-inner"
              value={prompt.instruction}
              onChange={(event) => updatePrompt(prompt.id, event.target.value)}
              placeholder="Nhập nội dung mẫu lệnh..."
            />
          </article>
        ))}

        {props.prompts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center rounded-2xl border border-dashed border-stone-800 bg-stone-900/10">
            <svg className="h-8 w-8 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xs text-stone-400">Bạn chưa thiết lập mẫu lệnh nào.</p>
          </div>
        )}
      </div>
    </section>
  );
}
