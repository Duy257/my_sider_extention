import React from "react";
import type { ListBlock, RenderMode } from "../block-types";
import { renderInline } from "./InlineRenderer";

export interface ListBlockRendererProps {
  block: ListBlock;
  mode?: RenderMode;
}

export function ListBlockRenderer({ block, mode = "tailwind" }: ListBlockRendererProps) {
  const ListTag = block.ordered ? "ol" : "ul";

  return (
    <ListTag
      className={
        mode === "tailwind"
          ? `my-1.5 ml-5 space-y-0.5 text-stone-200 ${block.ordered ? "list-decimal" : "list-disc"}`
          : undefined
      }
      style={
        mode === "inline"
          ? {
              margin: "6px 0 10px 20px",
              padding: 0,
              listStyleType: block.ordered ? "decimal" : "disc",
            }
          : undefined
      }
    >
      {block.items.map((item, idx) => (
        <li
          key={idx}
          className={mode === "tailwind" ? "leading-relaxed" : undefined}
          style={
            mode === "inline"
              ? {
                  marginBottom: "4px",
                  color: "#D6D3D1",
                  lineHeight: "1.6",
                }
              : undefined
          }
        >
          {renderInline(item.tokens, mode)}
        </li>
      ))}
    </ListTag>
  );
}
