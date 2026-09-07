import React, { useEffect, useMemo, useRef, useState } from "react";
import type { JsonBlock, RenderMode } from "../block-types";

export interface JsonBlockRendererProps {
  block: JsonBlock;
  mode?: RenderMode;
}

export function JsonBlockRenderer({ block, mode = "tailwind" }: JsonBlockRendererProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formattedJson = useMemo(() => {
    try {
      return JSON.stringify(block.data, null, 2);
    } catch {
      return block.raw;
    }
  }, [block.data, block.raw]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedJson);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.warn("Failed to copy json block:", err);
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
          ? "my-3 rounded-lg overflow-hidden border border-stone-800 bg-stone-950/90 text-xs font-mono"
          : undefined
      }
      style={
        mode === "inline"
          ? {
              margin: "12px 0",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid rgba(68, 64, 60, 0.6)",
              background: "#0C0A09",
              fontSize: "12px",
              fontFamily: "Consolas, Monaco, monospace",
            }
          : undefined
      }
    >
      <div
        className={
          mode === "tailwind"
            ? "flex items-center justify-between px-3 py-1.5 bg-stone-900/80 border-b border-stone-800 text-stone-400 select-none"
            : undefined
        }
        style={
          mode === "inline"
            ? {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 12px",
                background: "#1C1917",
                borderBottom: "1px solid rgba(68, 64, 60, 0.4)",
                color: "#A8A29E",
                userSelect: "none",
              }
            : undefined
        }
      >
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={
            mode === "tailwind"
              ? "flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-stone-300 hover:text-stone-100 cursor-pointer transition-colors"
              : undefined
          }
          style={
            mode === "inline"
              ? {
                  background: "transparent",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "#D6D3D1",
                  cursor: "pointer",
                }
              : undefined
          }
        >
          <span className="text-[10px]">{expanded ? "▼" : "▶"}</span>
          <span>JSON</span>
        </button>

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

      {expanded && (
        <pre
          className={
            mode === "tailwind"
              ? "max-h-80 overflow-auto p-3 text-xs leading-relaxed text-emerald-300/90 whitespace-pre"
              : undefined
          }
          style={
            mode === "inline"
              ? {
                  margin: 0,
                  padding: "10px 12px",
                  maxHeight: "320px",
                  overflow: "auto",
                  lineHeight: "1.5",
                  color: "#6EE7B7",
                  whiteSpace: "pre",
                }
              : undefined
          }
        >
          <code>{formattedJson}</code>
        </pre>
      )}
    </div>
  );
}
