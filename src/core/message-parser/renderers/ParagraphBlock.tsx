import React from "react";
import type { ParagraphBlock, RenderMode } from "../block-types";
import { renderInline } from "./InlineRenderer";

export interface ParagraphBlockRendererProps {
  block: ParagraphBlock;
  mode?: RenderMode;
}

export function ParagraphBlockRenderer({ block, mode = "tailwind" }: ParagraphBlockRendererProps) {
  return (
    <p
      className={mode === "tailwind" ? "my-0.5 text-stone-200 leading-relaxed" : undefined}
      style={
        mode === "inline"
          ? {
              margin: "0 0 6px 0",
              color: "#E7E5E4",
              lineHeight: "1.7",
            }
          : undefined
      }
    >
      {renderInline(block.tokens, mode)}
    </p>
  );
}
