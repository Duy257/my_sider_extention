import React from "react";

export function EmptyState(props: { onChipClick?: (text: string) => void }) {
  const chips = [
    { 
      label: "🔍 Giải thích khái niệm", 
      desc: "Làm rõ thuật ngữ hoặc định nghĩa khó hiểu",
      prompt: "Hãy giải thích chi tiết nhưng dễ hiểu khái niệm sau đây kèm ví dụ thực tế: " 
    },
    { 
      label: "🌐 Dịch thuật tự nhiên", 
      desc: "Dịch song ngữ Anh - Việt trôi chảy, đúng ngữ cảnh",
      prompt: "Dịch đoạn văn bản sau sang tiếng Việt (hoặc ngược lại nếu là tiếng Anh), đảm bảo diễn đạt tự nhiên như người bản xứ và giữ đúng thuật ngữ chuyên ngành: " 
    },
    { 
      label: "✍️ Nâng cấp văn phong", 
      desc: "Sửa lỗi ngữ pháp, viết lại chuyên nghiệp hơn",
      prompt: "Hãy sửa lỗi ngữ pháp và viết lại đoạn văn bản dưới đây theo phong cách chuyên nghiệp, lịch sự và thuyết phục hơn: " 
    },
    { 
      label: "📊 Tóm tắt thông tin", 
      desc: "Lọc ý chính và số liệu từ văn bản của bạn",
      prompt: "Tóm tắt các ý chính và lọc ra danh sách các số liệu, thông tin quan trọng từ đoạn văn bản sau: " 
    },
    { 
      label: "💻 Giải thích & Tối ưu Code", 
      desc: "Tìm lỗi và cải tiến hiệu năng đoạn mã",
      prompt: "Giải thích đoạn code sau hoạt động thế nào và gợi ý cách tối ưu hoặc sửa lỗi nếu có:\n\n```\n\n```" 
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

      <div className="flex flex-col gap-2.5 w-full max-w-[280px] mt-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 text-left pl-1">Gợi ý nhanh</span>
        <div className="flex flex-col gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              className="w-full text-left rounded-xl border border-stone-850 bg-stone-900/30 hover:bg-stone-800/40 px-3.5 py-2.5 text-stone-300 hover:text-stone-50 hover:border-primary/30 active:scale-[0.98] transition-all duration-200 shadow-sm flex flex-col gap-0.5 group"
              onClick={() => props.onChipClick?.(chip.prompt)}
            >
              <span className="text-xs font-semibold text-stone-200 group-hover:text-primary-light transition-colors duration-200">
                {chip.label}
              </span>
              <span className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors duration-200 leading-normal">
                {chip.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
