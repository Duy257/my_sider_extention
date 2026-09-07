import React from "react";
import type { MessageBlock, RenderMode } from "../block-types";
import { AlertBlockRenderer } from "./AlertBlock";
import { CodeBlockRenderer } from "./CodeBlock";
import { HeadingBlockRenderer } from "./HeadingBlock";
import { JsonBlockRenderer } from "./JsonBlock";
import { ListBlockRenderer } from "./ListBlock";
import { ParagraphBlockRenderer } from "./ParagraphBlock";
import { QuoteBlockRenderer } from "./QuoteBlock";
import { TableBlockRenderer } from "./TableBlock";

export interface MessageBlocksRendererProps {
  blocks: MessageBlock[];
  mode?: RenderMode;
}

export function MessageBlocksRenderer({
  blocks,
  mode = "tailwind",
}: MessageBlocksRendererProps) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return <HeadingBlockRenderer key={index} block={block} mode={mode} />;

          case "paragraph":
            return <ParagraphBlockRenderer key={index} block={block} mode={mode} />;

          case "code":
            return <CodeBlockRenderer key={index} block={block} mode={mode} />;

          case "table":
            return <TableBlockRenderer key={index} block={block} mode={mode} />;

          case "alert":
            return <AlertBlockRenderer key={index} block={block} mode={mode} />;

          case "json":
            return <JsonBlockRenderer key={index} block={block} mode={mode} />;

          case "list":
            return <ListBlockRenderer key={index} block={block} mode={mode} />;

          case "quote":
            return <QuoteBlockRenderer key={index} block={block} mode={mode} />;

          case "spacer":
            return (
              <div
                key={index}
                className={mode === "tailwind" ? "h-1.5" : undefined}
                style={mode === "inline" ? { height: "6px" } : undefined}
              />
            );

          default:
            return null;
        }
      })}
    </>
  );
}
