export function ChatMessage(props: {
  role: "user" | "assistant" | "system";
  content: string;
  onSave?: () => void;
}) {
  const isAssistant = props.role === "assistant";
  return (
    <article className={isAssistant ? "rounded bg-zinc-900 p-3" : "rounded bg-zinc-800 p-3"}>
      <div className="mb-1 text-[11px] uppercase text-zinc-500">{props.role}</div>
      <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-100">{props.content}</div>
      {isAssistant && props.onSave ? (
        <button className="mt-2 rounded bg-zinc-700 px-2 py-1 text-xs" onClick={props.onSave}>Lưu</button>
      ) : null}
    </article>
  );
}
