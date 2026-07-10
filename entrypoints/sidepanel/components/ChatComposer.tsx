import React, { useState, useRef, useEffect } from "react";

function SendArrow() {
  return (
    <svg className="h-4 w-4 transform transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SendSpinner() {
  return (
    <svg className="h-4 w-4 animate-spinner" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ChatComposer(props: {
  disabled: boolean;
  onSend: (text: string, thinkingMode?: "off" | "low" | "medium" | "high" | "max") => void;
  showMissingKeyBanner?: boolean;
  missingType?: "key" | "model";
  providerLabel?: string;
  sending?: boolean;
  defaultThinkingMode?: "off" | "low" | "medium" | "high" | "max";
}) {
  const [value, setValue] = useState("");
  const [thinkingMode, setThinkingMode] = useState<"off" | "low" | "medium" | "high" | "max">(
    props.defaultThinkingMode ?? "off"
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize height as typing happens
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || props.disabled) return;
    props.onSend(text, thinkingMode);
    setValue("");
    setThinkingMode(props.defaultThinkingMode ?? "off");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const text = value.trim();
      if (!text || props.disabled) return;
      props.onSend(text, thinkingMode);
      setValue("");
      setThinkingMode(props.defaultThinkingMode ?? "off");
    }
  };

  return (
    <div className="sticky bottom-0 bg-gradient-to-t from-warm-bg via-warm-bg/95 to-transparent pt-4 pb-3.5 px-3 border-t border-stone-850/40 backdrop-blur-sm">
      {props.showMissingKeyBanner && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-900/30 bg-amber-950/20 px-3.5 py-2.5 text-xs text-amber-300 animate-fade-in-up">
          <svg className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <span className="font-semibold block mb-0.5">Yêu cầu thiết lập</span>
            {props.missingType === "model"
              ? `Chọn mô hình cho ${props.providerLabel || "nhà cung cấp"} trong Cài đặt trước khi gửi.`
              : `Thêm khóa API cho ${props.providerLabel || "nhà cung cấp"} trong Cài đặt trước khi gửi.`}
          </div>
        </div>
      )}

      <form className="relative flex items-end w-full group/form" onSubmit={handleSubmit}>
        <div className="flex items-end gap-2 w-full">
          <div className="relative flex-shrink-0">
            <select
              className="appearance-none rounded-xl border border-stone-850 bg-surface/90 px-2.5 py-2.5 text-[11px] font-medium text-stone-400 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/45 transition-colors cursor-pointer min-w-[90px]"
              value={thinkingMode}
              onChange={(e) => setThinkingMode(e.target.value as any)}
              disabled={props.disabled}
              title="Mức tư duy"
            >
              <option value="off">🧠 Tắt</option>
              <option value="low">Thấp</option>
              <option value="medium">Vừa</option>
              <option value="high">Cao</option>
              <option value="max">Tối đa</option>
            </select>
          </div>
          <textarea
            ref={textareaRef}
            className="min-h-[44px] max-h-32 w-full resize-none rounded-xl border border-stone-800 bg-surface/90 py-2.5 pl-3.5 pr-11 text-[13.5px] leading-relaxed text-stone-100 placeholder-stone-500 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/45 transition-all duration-300 shadow-inner"
            value={value}
            disabled={props.disabled}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi về công việc của bạn..."
            rows={1}
            aria-label="Hỏi về công việc của bạn"
          />
          <button
            className={`absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-dark transition-all duration-300 shadow-md disabled:bg-stone-800 disabled:text-stone-500 disabled:opacity-40 disabled:shadow-none group-hover/form:shadow-primary/10 group/btn cursor-pointer`}
            type="submit"
            disabled={props.disabled || !value.trim()}
            title="Gửi"
          >
            {props.sending ? <SendSpinner /> : <SendArrow />}
          </button>
        </div>
      </form>
    </div>
  );
}
