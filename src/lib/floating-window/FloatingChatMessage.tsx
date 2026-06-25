import React, { useRef } from "react";
import type { StreamState } from "./types";

const styles = {
  container: {
    animation: "floating-fade-in-up 0.3s ease-out",
    padding: "2px",
  },
  text: {
    color: "#E7E5E4", // Softer stone-200 text color
    fontSize: "13.5px",
    lineHeight: "1.7",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  cursor: {
    display: "inline-block",
    width: "6px",
    height: "14px",
    background: "#A78BFA",
    animation: "floating-blink 0.8s step-end infinite",
    marginLeft: "3px",
    verticalAlign: "text-bottom",
  },
};

// Custom lightweight markdown renderer to display text beautifully with styling
function renderMarkdown(content: string, isStreaming: boolean, cursorElement: React.ReactNode) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentCodeBlock: { lang: string; lines: string[] } | null = null;
  let currentList: { items: string[]; type: "ul" | "ol" } | null = null;

  const parseInlineStyles = (text: string, appendCursor: boolean = false): React.ReactNode[] => {
    // Parse bold (**text**), italic (*text*), and inline code (`code`)
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
    const parts = text.split(regex);
    const nodes = parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx} style={{ fontWeight: 700, color: "#F5F5F4" }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={idx} style={{ fontStyle: "italic", color: "#D6D3D1" }}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={idx}
            style={{
              background: "#292524",
              color: "#F472B6",
              padding: "2px 5px",
              borderRadius: "4px",
              fontSize: "12px",
              fontFamily: "Consolas, Monaco, monospace",
              border: "1px solid rgba(244, 114, 182, 0.15)",
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });

    if (appendCursor) {
      nodes.push(<React.Fragment key="cursor">{cursorElement}</React.Fragment>);
    }
    return nodes;
  };

  const flushList = (key: number, appendCursor: boolean = false) => {
    if (!currentList) return null;
    const itemsCount = currentList.items.length;
    const el = (
      <ul key={key} style={{ margin: "6px 0 10px 18px", listStyleType: "disc", padding: 0 }}>
        {currentList.items.map((item, idx) => {
          const isLastItem = idx === itemsCount - 1;
          return (
            <li key={idx} style={{ marginBottom: "4px", color: "#D6D3D1" }}>
              {parseInlineStyles(item, appendCursor && isLastItem)}
            </li>
          );
        })}
      </ul>
    );
    currentList = null;
    return el;
  };

  const flushCodeBlock = (key: number, appendCursor: boolean = false) => {
    if (!currentCodeBlock) return null;
    const codeContent = currentCodeBlock.lines.join("\n");
    const el = (
      <div
        key={key}
        style={{
          margin: "12px 0",
          background: "#0C0A09",
          border: "1px solid rgba(68, 64, 60, 0.6)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "#1C1917",
            padding: "4px 12px",
            fontSize: "11px",
            color: "#A8A29E",
            borderBottom: "1px solid rgba(68, 64, 60, 0.4)",
            display: "flex",
            justifyContent: "space-between",
            textTransform: "uppercase",
            fontFamily: "system-ui, sans-serif",
            fontWeight: 600,
            userSelect: "none",
          }}
        >
          <span>{currentCodeBlock.lang || "code"}</span>
        </div>
        <pre
          style={{
            margin: 0,
            padding: "10px 12px",
            overflowX: "auto",
            fontFamily: "Consolas, Monaco, 'Andale Mono', monospace",
            fontSize: "12.5px",
            color: "#C084FC",
            lineHeight: "1.5",
          }}
        >
          <code>{codeContent}{appendCursor ? cursorElement : null}</code>
        </pre>
      </div>
    );
    currentCodeBlock = null;
    return el;
  };

  let keyIndex = 0;
  const totalLines = lines.length;

  for (let i = 0; i < totalLines; i++) {
    const line = lines[i];
    const isLastLine = i === totalLines - 1;

    // Check code blocks
    if (line.trim().startsWith("```")) {
      if (currentCodeBlock) {
        elements.push(flushCodeBlock(keyIndex++, isStreaming && isLastLine));
      } else {
        if (currentList) elements.push(flushList(keyIndex++));
        const lang = line.trim().slice(3).trim();
        currentCodeBlock = { lang, lines: [] };
      }
      continue;
    }

    if (currentCodeBlock) {
      currentCodeBlock.lines.push(line);
      continue;
    }

    // Check lists
    const matchUl = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (matchUl) {
      if (!currentList) {
        currentList = { items: [], type: "ul" };
      }
      currentList.items.push(matchUl[2]);
      continue;
    }

    // If it's not a list line and list exists, flush list
    if (currentList) {
      elements.push(flushList(keyIndex++, isStreaming && isLastLine && !line));
    }

    // Check headers
    const matchHeader = line.match(/^(#{1,6})\s+(.*)/);
    if (matchHeader) {
      const level = matchHeader[1].length;
      const title = matchHeader[2];
      const fontSize = level === 1 ? "18px" : level === 2 ? "16px" : "14.5px";
      const marginTop = i === 0 ? "0" : "14px";
      elements.push(
        <h3
          key={keyIndex++}
          style={{
            fontSize,
            fontWeight: 700,
            margin: `${marginTop} 0 8px 0`,
            color: "#FAFAF9",
            lineHeight: "1.4",
            borderBottom: level <= 2 ? "1px solid rgba(68, 64, 60, 0.3)" : "none",
            paddingBottom: level <= 2 ? "4px" : "0",
          }}
        >
          {parseInlineStyles(title, isStreaming && isLastLine)}
        </h3>
      );
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      if (isStreaming && isLastLine) {
        // Append cursor to an empty block if it is streaming at the very end
        elements.push(<span key={keyIndex++}>{cursorElement}</span>);
      } else {
        elements.push(<div key={keyIndex++} style={{ height: "6px" }} />);
      }
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={keyIndex++} style={{ margin: "0 0 8px 0", color: "#E7E5E4", lineHeight: "1.7" }}>
        {parseInlineStyles(line, isStreaming && isLastLine)}
      </p>
    );
  }

  // Final flushes
  if (currentCodeBlock) elements.push(flushCodeBlock(keyIndex++, isStreaming));
  if (currentList) elements.push(flushList(keyIndex++, isStreaming));

  return elements;
}

export function FloatingChatMessage(props: {
  content: string;
  streamState: StreamState;
}) {
  const isStreaming = props.streamState === "streaming";
  const cursorNode = <span style={styles.cursor} />;

  return (
    <div style={styles.container}>
      <div style={styles.text}>
        {renderMarkdown(props.content, isStreaming, cursorNode)}
      </div>
    </div>
  );
}
