/**
 * Inline and block types for message parsing and rich content rendering.
 */

export type RenderMode = "tailwind" | "inline";

export type InlineTokenType =
  | "text"
  | "bold"
  | "italic"
  | "bold-italic"
  | "code"
  | "link";

export type InlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "bold-italic"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; url: string };

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface HeadingBlock {
  type: "heading";
  level: HeadingLevel;
  text: string;
  tokens: InlineToken[];
}

export interface ParagraphBlock {
  type: "paragraph";
  text: string;
  tokens: InlineToken[];
}

export interface CodeBlock {
  type: "code";
  lang: string;
  code: string;
  lines: string[];
}

export interface ListItem {
  raw: string;
  tokens: InlineToken[];
}

export interface ListBlock {
  type: "list";
  ordered: boolean;
  items: ListItem[];
}

export interface QuoteBlock {
  type: "quote";
  text: string;
  lines: string[];
  tokens: InlineToken[];
}

export type TableAlignment = "left" | "center" | "right";

export interface TableBlock {
  type: "table";
  headers: string[];
  rows: string[][];
  alignments: TableAlignment[];
}

export type AlertVariant =
  | "warning"
  | "error"
  | "tip"
  | "info"
  | "note"
  | "success";

export type AlertColor = "amber" | "red" | "blue" | "purple" | "green";

export interface AlertBlock {
  type: "alert";
  variant: AlertVariant;
  color?: AlertColor;
  icon?: string;
  label?: string;
  content: string;
  tokens: InlineToken[];
}

export interface JsonBlock {
  type: "json";
  data: unknown;
  raw: string;
}

export interface SpacerBlock {
  type: "spacer";
}

export type MessageBlock =
  | HeadingBlock
  | ParagraphBlock
  | CodeBlock
  | ListBlock
  | QuoteBlock
  | TableBlock
  | AlertBlock
  | JsonBlock
  | SpacerBlock;
