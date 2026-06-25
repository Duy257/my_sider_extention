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
        AI Cá Nhân
      </button>
      <div className="flex gap-1">
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs disabled:opacity-50" onClick={props.onReadPage} disabled={props.readingPage}>{props.readingPage ? "Đang đọc..." : "Đọc trang"}</button>
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => props.onViewChange("prompts")}>Mẫu lệnh</button>
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => props.onViewChange("saved")}>Đã lưu</button>
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => props.onViewChange("settings")}>Cài đặt</button>
      </div>
    </header>
  );
}
