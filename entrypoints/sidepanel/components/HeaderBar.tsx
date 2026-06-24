export type HeaderView = "chat" | "prompts" | "saved" | "settings";

export function HeaderBar(props: {
  view: HeaderView;
  onViewChange: (view: HeaderView) => void;
  onReadPage: () => void;
  readingPage?: boolean;
}) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
      <button className="text-sm font-semibold text-zinc-50" onClick={() => props.onViewChange("chat")}>
        Personal AI
      </button>
      <div className="flex gap-1">
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs disabled:opacity-50" onClick={props.onReadPage} disabled={props.readingPage}>{props.readingPage ? "Reading..." : "Read page"}</button>
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => props.onViewChange("prompts")}>Prompts</button>
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => props.onViewChange("saved")}>Saved</button>
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => props.onViewChange("settings")}>Settings</button>
      </div>
    </header>
  );
}
