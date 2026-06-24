import { useState } from "react";

export function ChatComposer(props: { disabled: boolean; onSend: (text: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <form
      className="border-t border-zinc-800 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const text = value.trim();
        if (!text) return;
        props.onSend(text);
        setValue("");
      }}
    >
      <textarea
        className="h-24 w-full resize-none rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50 outline-none"
        value={value}
        disabled={props.disabled}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Ask about your work"
      />
      <button className="mt-2 w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:bg-zinc-700" disabled={props.disabled}>
        Send
      </button>
    </form>
  );
}
