import React from "react";
import type { QuoteBlock, RenderMode } from "../block-types";
import { renderInline } from "./InlineRenderer";

export interface QuoteBlockRendererProps {
  block: QuoteBlock;
  mode?: RenderMode;
}

export function QuoteBlockRenderer({ block, mode = "tailwind" }: QuoteBlockRendererProps) {
  return (
    <blockquote
      className={
        mode === "tailwind"
          ? "my-2.5 border-l-2 border-stone-600 pl-3.5 italic text-stone-300 space-y-1"
          : undefined
      }
      style={
        mode === "inline"
          ? {
              margin: "8px 0",
              borderLeft: "2px solid #57534E",
              paddingLeft: "12px",
              fontStyle: "italic",
              color: "#D6D3D1",
              lineHeight: "1.6",
            }
          : undefined
      }
    >
      <div>{renderInline(block.tokens, mode)}</div>
    </blockquote>
  );
}
