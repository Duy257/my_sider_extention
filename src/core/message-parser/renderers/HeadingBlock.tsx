import React from "react";
import type { HeadingBlock, HeadingLevel, RenderMode } from "../block-types";
import { renderInline } from "./InlineRenderer";

export interface HeadingBlockRendererProps {
  block: HeadingBlock;
  mode?: RenderMode;
}

const HEADING_TAILWIND_CLS: Record<HeadingLevel, string> = {
  1: "text-base font-bold text-stone-50 mt-4 mb-2 pb-1 border-b border-stone-800/50",
  2: "text-sm font-bold text-stone-50 mt-3 mb-1.5 pb-0.5 border-b border-stone-800/30",
  3: "text-[13px] font-bold text-stone-100 mt-3 mb-1",
  4: "text-[13px] font-semibold text-stone-200 mt-2 mb-1",
  5: "text-[12.5px] font-semibold text-stone-300 mt-2 mb-0.5",
  6: "text-[12px] font-semibold text-stone-400 mt-2 mb-0.5 uppercase tracking-wide",
};

const HEADING_INLINE_STYLES: Record<HeadingLevel, React.CSSProperties> = {
  1: {
    fontSize: "18px",
    fontWeight: 700,
    margin: "14px 0 8px 0",
    color: "#FAFAF9",
    lineHeight: "1.4",
    borderBottom: "1px solid rgba(68, 64, 60, 0.4)",
    paddingBottom: "4px",
  },
  2: {
    fontSize: "16px",
    fontWeight: 700,
    margin: "12px 0 6px 0",
    color: "#FAFAF9",
    lineHeight: "1.4",
    borderBottom: "1px solid rgba(68, 64, 60, 0.3)",
    paddingBottom: "3px",
  },
  3: {
    fontSize: "14.5px",
    fontWeight: 700,
    margin: "10px 0 6px 0",
    color: "#F5F5F4",
    lineHeight: "1.4",
  },
  4: {
    fontSize: "13.5px",
    fontWeight: 600,
    margin: "8px 0 4px 0",
    color: "#E7E5E4",
    lineHeight: "1.4",
  },
  5: {
    fontSize: "12.5px",
    fontWeight: 600,
    margin: "8px 0 4px 0",
    color: "#D6D3D1",
    lineHeight: "1.4",
  },
  6: {
    fontSize: "12px",
    fontWeight: 600,
    margin: "8px 0 4px 0",
    color: "#A8A29E",
    lineHeight: "1.4",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
};

export function HeadingBlockRenderer({ block, mode = "tailwind" }: HeadingBlockRendererProps) {
  const level = block.level;
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

  return (
    <Tag
      className={mode === "tailwind" ? HEADING_TAILWIND_CLS[level] : undefined}
      style={mode === "inline" ? HEADING_INLINE_STYLES[level] : undefined}
    >
      {renderInline(block.tokens, mode)}
    </Tag>
  );
}
