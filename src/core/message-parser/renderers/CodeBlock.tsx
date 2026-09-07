import React, { useEffect, useRef, useState } from "react";
import type { CodeBlock, RenderMode } from "../block-types";

export interface CodeBlockRendererProps {
  block: CodeBlock;
  mode?: RenderMode;
}

export function CodeBlockRenderer({ block, mode = "tailwind" }: CodeBlockRendererProps) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(block.code);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.warn("Failed to copy code block:", err);
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  return (
    <div
      className={
        mode === "tailwind"
          ? "my-3 rounded-lg overflow-hidden border border-stone-800 bg-stone-950"
          : undefined
      }
      style={
        mode === "inline"
          ? {
              margin: "12px 0",
              background: "#0C0A09",
              border: "1px solid rgba(68, 64, 60, 0.6)",
              borderRadius: "8px",
              overflow: "hidden",
            }
          : undefined
      }
    >
      <div
        className={
          mode === "tailwind"
            ? "flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 bg-stone-900/80 border-b border-stone-800"
            : undefined
        }
        style={
          mode === "inline"
            ? {
                background: "#1C1917",
                padding: "4px 12px",
                fontSize: "11px",
                color: "#A8A29E",
                borderBottom: "1px solid rgba(68, 64, 60, 0.4)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                textTransform: "uppercase",
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600,
                userSelect: "none",
              }
            : undefined
        }
      >
        <span>{block.lang || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={
            mode === "tailwind"
              ? "text-stone-400 hover:text-violet-400 transition-colors cursor-pointer text-[10px] font-medium"
              : undefined
          }
          style={
            mode === "inline"
              ? {
                  background: "transparent",
                  border: "none",
                  color: copied ? "#34D399" : "#A8A29E",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontWeight: 500,
                  transition: "color 150ms",
                }
              : undefined
          }
        >
          {copied ? "Đã sao chép" : "Sao chép"}
        </button>
      </div>
      <pre
        className={
          mode === "tailwind"
            ? "max-h-96 overflow-auto p-3 text-xs leading-relaxed text-purple-300 font-mono"
            : undefined
        }
        style={
          mode === "inline"
            ? {
                margin: 0,
                padding: "10px 12px",
                maxHeight: "384px",
                overflow: "auto",
                fontFamily: "Consolas, Monaco, 'Andale Mono', monospace",
                fontSize: "12.5px",
                color: "#C084FC",
                lineHeight: "1.5",
              }
            : undefined
        }
      >
        <code>{block.code}</code>
      </pre>
    </div>
  );
}
