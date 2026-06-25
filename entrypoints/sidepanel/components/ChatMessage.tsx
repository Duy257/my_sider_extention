import React from "react";
import { MessageContent } from "../../../src/lib/ui/MessageContent";

function RobotAvatar() {
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface border border-stone-800 shadow-inner group/avatar">
      <svg className="h-4 w-4 text-primary-light transition-transform duration-300 group-hover/avatar:rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <circle cx="9" cy="13" r="1" fill="currentColor" />
        <circle cx="15" cy="13" r="1" fill="currentColor" />
        <path d="M12 3v3" strokeLinecap="round" />
        <path d="M8 3l2 2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function ChatMessage(props: {
  role: "user" | "assistant" | "system";
  content: string;
  onSave?: () => void;
}) {
  const isUser = props.role === "user";
  const isSystem = props.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2.5 animate-fade-in-up">
        <div className="rounded-full bg-stone-900/60 border border-stone-800/50 px-3 py-1 text-center text-xs text-stone-500 max-w-[90%] font-medium">
          {props.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2.5 ${isUser ? "justify-end" : "justify-start"} animate-fade-in-up`}>
      {!isUser && <RobotAvatar />}
      <div className={`flex flex-col group ${isUser ? "items-end max-w-[85%]" : "items-start max-w-[85%]"}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words transition-all duration-300 shadow-sm ${
            isUser
              ? "bg-primary text-white rounded-br-none shadow-primary/10 hover:shadow-primary/20 bg-gradient-to-br from-primary to-purple-600 hover:brightness-105"
              : "bg-surface border border-stone-800/60 text-stone-100 rounded-bl-none hover:border-stone-700/80"
          }`}
        >
          <MessageContent content={props.content} />
        </div>
        {!isUser && props.onSave && (
          <div className="mt-1 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
            <button
              className="flex items-center gap-1 rounded-md border border-stone-800/40 bg-surface/50 hover:bg-surface hover:border-stone-700/60 hover:text-stone-200 px-2 py-1 text-[11px] text-stone-400 font-medium transition-all duration-200"
              title="Lưu"
              onClick={props.onSave}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Lưu kết quả
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 animate-fade-in-up">
      <RobotAvatar />
      <div className="rounded-2xl rounded-bl-none bg-surface border border-stone-800/60 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5 h-3">
          <div className="h-1.5 w-1.5 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0s" }} />
          <div className="h-1.5 w-1.5 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0.2s" }} />
          <div className="h-1.5 w-1.5 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0.4s" }} />
        </div>
        <div className="mt-1 text-[10px] text-stone-500 font-medium tracking-wide">đang trả lời...</div>
      </div>
    </div>
  );
}
