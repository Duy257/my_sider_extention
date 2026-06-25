import React from "react";

function parseInline(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-bold text-stone-50">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={idx} className="italic text-stone-200">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="rounded px-1.5 py-0.5 text-xs font-mono text-pink-400 bg-stone-900 border border-stone-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function MessageContent({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let codeBlock: { lang: string; lines: string[] } | null = null;
  let listItems: string[] | null = null;
  let keyIndex = 0;

  const flushList = (k: number) => {
    if (!listItems) return null;
    const el = (
      <ul key={k} className="my-1.5 ml-5 list-disc space-y-0.5 text-stone-200">
        {listItems.map((item, i) => (
          <li key={i}>{parseInline(item)}</li>
        ))}
      </ul>
    );
    listItems = null;
    return el;
  };

  const flushCode = (k: number) => {
    if (!codeBlock) return null;
    const el = (
      <div key={k} className="my-3 rounded-lg overflow-hidden border border-stone-800 bg-stone-950">
        {codeBlock.lang && (
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 bg-stone-900/80 border-b border-stone-800">
            {codeBlock.lang}
          </div>
        )}
        <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-purple-300 font-mono">
          <code>{codeBlock.lines.join("\n")}</code>
        </pre>
      </div>
    );
    codeBlock = null;
    return el;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (codeBlock) {
        elements.push(flushCode(keyIndex++));
      } else {
        if (listItems) elements.push(flushList(keyIndex++));
        const lang = line.trim().slice(3).trim();
        codeBlock = { lang, lines: [] };
      }
      continue;
    }

    if (codeBlock) {
      codeBlock.lines.push(line);
      continue;
    }

    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (ulMatch) {
      if (!listItems) listItems = [];
      listItems.push(ulMatch[2]);
      continue;
    }

    if (listItems) {
      elements.push(flushList(keyIndex++));
    }

    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const title = hMatch[2];
      const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      const cls = level === 1
        ? "text-base font-bold text-stone-50 mt-4 mb-2 pb-1 border-b border-stone-800/50"
        : level === 2
          ? "text-sm font-bold text-stone-50 mt-3 mb-1.5 pb-0.5 border-b border-stone-800/30"
          : "text-[13px] font-bold text-stone-100 mt-3 mb-1";
      elements.push(
        <Tag key={keyIndex++} className={cls}>
          {parseInline(title)}
        </Tag>
      );
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={keyIndex++} className="h-1.5" />);
      continue;
    }

    elements.push(
      <p key={keyIndex++} className="my-0.5 text-stone-200">
        {parseInline(line)}
      </p>
    );
  }

  if (codeBlock) elements.push(flushCode(keyIndex++));
  if (listItems) elements.push(flushList(keyIndex++));

  return <>{elements}</>;
}
