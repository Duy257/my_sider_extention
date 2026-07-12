export type HeaderView = "chat" | "prompts" | "saved" | "settings";

function RobotIcon() {
  return (
    <div className="relative flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-tr from-primary to-purple-500 shadow-md shadow-primary/20 transition-all duration-300 group-hover:scale-105">
      <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <circle cx="9" cy="13" r="1" fill="currentColor" />
        <circle cx="15" cy="13" r="1" fill="currentColor" />
        <path d="M12 3v3" strokeLinecap="round" />
        <path d="M8 3l2 2" strokeLinecap="round" />
        <path d="M16 3l-2 2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function HeaderBar(props: {
  view: HeaderView;
  onViewChange: (view: HeaderView) => void;
  onClearChat?: () => void;
  hasMessages?: boolean;
}) {
  const tabs: { view: HeaderView; title: string; label: string; icon: React.ReactNode }[] = [
    {
      view: "prompts",
      title: "Mẫu lệnh",
      label: "Mẫu lệnh",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      view: "saved",
      title: "Đã lưu",
      label: "Đã lưu",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
    {
      view: "settings",
      title: "Cài đặt",
      label: "Cài đặt",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-stone-850 bg-warm-bg/85 px-3 py-2.5 backdrop-blur-md transition-all duration-300">
      <button 
        className="group flex items-center gap-2 text-sm font-semibold text-stone-100 hover:text-stone-50 transition-colors" 
        onClick={() => props.onViewChange("chat")}
      >
        <RobotIcon />
        <span className="bg-gradient-to-r from-stone-50 via-stone-100 to-stone-300 bg-clip-text text-transparent group-hover:from-white group-hover:to-stone-200">
          AI Cá Nhân
        </span>
      </button>

      <div className="flex items-center gap-1">
        {/* Chat mới Button */}
        {props.view === "chat" && props.hasMessages && props.onClearChat && (
          <button
            type="button"
            title="Chat mới"
            onClick={props.onClearChat}
            className="flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-stone-850 bg-surface/60 text-stone-200 hover:border-primary/40 hover:bg-primary-glow hover:text-primary-light transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(124,58,237,0.05)]"
          >
            <svg className="h-4 w-4 text-stone-400 group-hover:text-primary-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Chat mới</span>
          </button>
        )}

        {/* AI Reading Companion Button */}
        <button
          className="flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-200 transition-all duration-200 border border-transparent hover:bg-surface-hover hover:text-stone-50 active:scale-95"
          title="Đọc với AI"
          onClick={() => {
            chrome.runtime.sendMessage({ type: "OPEN_READING_COMPANION", requestId: crypto.randomUUID() });
          }}
        >
          <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="hidden sm:inline">Đọc với AI</span>
        </button>

        {/* Divider */}
        <div className="h-4 w-[1px] bg-stone-800 mx-0.5" />

        {/* Tabs */}
        {tabs.map((tab) => {
          const isActive = props.view === tab.view;
          return (
            <button
              key={tab.view}
              className={`group/btn relative flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 border border-transparent ${
                isActive
                  ? "text-primary bg-primary-glow border-primary/20 shadow-[0_0_12px_rgba(124,58,237,0.1)]"
                  : "text-stone-400 hover:text-stone-200 hover:bg-surface-hover hover:border-stone-800 active:scale-95"
              }`}
              title={tab.title}
              onClick={() => props.onViewChange(tab.view)}
            >
              {tab.icon}
              {isActive && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
