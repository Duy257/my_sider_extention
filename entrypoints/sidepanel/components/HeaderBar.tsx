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

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spinner text-primary-light" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function HeaderBar(props: {
  view: HeaderView;
  onViewChange: (view: HeaderView) => void;
  onReadPage: () => void;
  readingPage?: boolean;
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
        {/* Read Page Button */}
        <button
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-200 transition-all duration-200 border border-transparent ${
            props.readingPage 
              ? "bg-primary-glow border-primary/20 text-primary-light" 
              : "hover:bg-surface-hover hover:text-stone-50 active:scale-95"
          }`}
          title="Đọc trang"
          onClick={props.onReadPage}
          disabled={props.readingPage}
        >
          {props.readingPage ? (
            <>
              <Spinner />
              <span className="hidden sm:inline animate-pulse">Đang đọc...</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4 text-stone-400 group-hover:text-stone-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="hidden sm:inline">Đọc trang</span>
            </>
          )}
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
