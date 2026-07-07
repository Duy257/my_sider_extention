export function ReaderHeader(props: {
  title: string;
  onBack: () => void;
  onSave: () => void;
  saving?: boolean;
  saved?: boolean;
}) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-stone-850 bg-warm-bg/85 px-4 py-3 backdrop-blur-md">
      <button
        onClick={props.onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-stone-400 hover:text-stone-200 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Quay lại
      </button>

      <h1 className="flex-1 truncate px-3 text-center text-sm font-semibold text-stone-100">
        {props.title}
      </h1>

      <button
        onClick={props.onSave}
        disabled={props.saving || props.saved}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
          props.saved
            ? "text-emerald-400 bg-emerald-950/20 border border-emerald-900/30"
            : "text-stone-300 hover:text-stone-100 hover:bg-surface-hover border border-transparent hover:border-stone-800 active:scale-95"
        }`}
      >
        {props.saved ? (
          <>✓ Đã lưu</>
        ) : props.saving ? (
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Lưu
          </>
        )}
      </button>
    </header>
  );
}
