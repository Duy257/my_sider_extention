import React from "react";

export function EmptyState(props: { onChipClick?: (text: string) => void }) {
  const chips = [
    { 
      label: "📝 Tóm tắt trang này", 
      prompt: "Hãy tóm tắt nội dung trang này một cách súc tích, tập trung vào các điểm chính." 
    },
    { 
      label: "💡 Phân tích CEO", 
      prompt: "Phân tích nội dung được chọn dưới góc nhìn CEO, đưa ra nhận định thực tế." 
    },
    { 
      label: "✍️ Viết lại email", 
      prompt: "Hãy viết lại nội dung sau đây thành một email chuyên nghiệp, lịch sự nhưng súc tích." 
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-6 py-14 text-center animate-fade-in-up">
      {/* Icon with beautiful animated pulsing glow */}
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-surface border border-stone-850 shadow-inner group transition-all duration-500 hover:border-primary/40">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-primary/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-primary to-purple-500 opacity-0 blur-md group-hover:opacity-15 transition-opacity duration-500" />
        <svg className="h-7 w-7 text-stone-400 group-hover:text-primary-light transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-stone-200">Bắt đầu trò chuyện</h3>
        <p className="text-xs text-stone-400 leading-relaxed max-w-[280px]">
          Hỏi về trang hiện tại, văn bản đã chọn, hoặc nhập yêu cầu bất kỳ bên dưới.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-[280px] mt-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 text-left pl-1">Gợi ý nhanh</span>
        <div className="flex flex-col gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.label}
              className="w-full text-left rounded-xl border border-stone-800/40 bg-surface/50 px-3.5 py-2.5 text-xs text-stone-300 hover:text-stone-100 hover:bg-surface hover:border-primary/30 active:scale-[0.98] transition-all duration-200"
              onClick={() => props.onChipClick?.(chip.prompt)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
