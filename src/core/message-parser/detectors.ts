import type {
  AlertBlock,
  AlertColor,
  AlertVariant,
  CodeBlock,
  HeadingBlock,
  HeadingLevel,
  JsonBlock,
  ListBlock,
  ListItem,
  MessageBlock,
  QuoteBlock,
  TableAlignment,
  TableBlock,
} from "./block-types";
import { tokenizeInline } from "./tokenizer";

const ALERT_PREFIXES = [
  { icon: "⚠️", label: "Cảnh báo", variant: "warning" as AlertVariant, color: "amber" as AlertColor },
  { icon: "🟡", label: "Cảnh báo", variant: "warning" as AlertVariant, color: "amber" as AlertColor },
  { icon: "❗", label: "Quan trọng", variant: "error" as AlertVariant, color: "red" as AlertColor },
  { icon: "🔴", label: "Lỗi", variant: "error" as AlertVariant, color: "red" as AlertColor },
  { icon: "💡", label: "Mẹo", variant: "tip" as AlertVariant, color: "blue" as AlertColor },
  { icon: "📌", label: "Ghi chú", variant: "note" as AlertVariant, color: "purple" as AlertColor },
  { icon: "ℹ️", label: "Thông tin", variant: "info" as AlertVariant, color: "blue" as AlertColor },
  { icon: "✅", label: "Lưu ý", variant: "success" as AlertVariant, color: "green" as AlertColor },
  { icon: "🟢", label: "Thành công", variant: "success" as AlertVariant, color: "green" as AlertColor },
];

/**
 * Detects markdown heading (# to ######) - fixing [C1].
 */
export function detectHeading(line: string): HeadingBlock | null {
  const match = line.match(/^(#{1,6})\s+(.*)$/);
  if (!match) return null;

  const level = match[1].length as HeadingLevel;
  const text = match[2].trim();
  return {
    type: "heading",
    level,
    text,
    tokens: tokenizeInline(text),
  };
}

/**
 * Detects fenced code blocks (```lang ... ``` or ~~~lang ... ~~~).
 * Gracefully handles unclosed fences during streaming.
 */
export function detectCodeBlock(
  lines: string[],
  startIndex: number,
): { block: CodeBlock; nextIndex: number } | null {
  const line = lines[startIndex].trim();
  if (!line.startsWith("```") && !line.startsWith("~~~")) return null;

  const fence = line.slice(0, 3);
  const lang = line.slice(3).trim();
  const codeLines: string[] = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    if (lines[i].trim().startsWith(fence)) {
      i++; // consume closing fence
      break;
    }
    codeLines.push(lines[i]);
    i++;
  }

  return {
    block: {
      type: "code",
      lang,
      code: codeLines.join("\n"),
      lines: codeLines,
    },
    nextIndex: i,
  };
}

function parseTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  let trimmed = line.trim();
  if (!trimmed.includes("-")) return false;
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  const parts = trimmed.split("|").map((p) => p.trim());
  if (parts.length === 0) return false;
  return parts.every((p) => /^:?-+:?$/.test(p));
}

function parseAlignment(cell: string): TableAlignment {
  const trimmed = cell.trim();
  const starts = trimmed.startsWith(":");
  const ends = trimmed.endsWith(":");
  if (starts && ends) return "center";
  if (ends) return "right";
  return "left";
}

/**
 * Detects markdown tables (| a | b |\n|---|---|\n| 1 | 2 |).
 */
export function detectTable(
  lines: string[],
  startIndex: number,
): { block: TableBlock; nextIndex: number } | null {
  if (startIndex + 1 >= lines.length) return null;

  const headerLine = lines[startIndex].trim();
  const sepLine = lines[startIndex + 1].trim();

  if (!headerLine.includes("|") || !isTableSeparator(sepLine)) {
    return null;
  }

  const headers = parseTableRow(headerLine);
  let sepTrimmed = sepLine;
  if (sepTrimmed.startsWith("|")) sepTrimmed = sepTrimmed.slice(1);
  if (sepTrimmed.endsWith("|")) sepTrimmed = sepTrimmed.slice(0, -1);
  const alignments = sepTrimmed.split("|").map(parseAlignment);

  const rows: string[][] = [];
  let i = startIndex + 2;

  while (i < lines.length) {
    const rowLine = lines[i].trim();
    if (!rowLine || !rowLine.includes("|")) break;
    rows.push(parseTableRow(lines[i]));
    i++;
  }

  return {
    block: {
      type: "table",
      headers,
      rows,
      alignments,
    },
    nextIndex: i,
  };
}

/**
 * Detects alert / callout blocks (⚠️, 💡, ❗, ✅, 📌, 🔴, 🟡, 🟢, or [!NOTE], [!TIP], etc.).
 */
export function detectAlert(
  lines: string[],
  startIndex: number,
): { block: AlertBlock; nextIndex: number } | null {
  const firstLine = lines[startIndex].trim();

  // 1. GitHub alert syntax: > [!NOTE] or [!NOTE]
  const ghMatch = firstLine.match(/^(?:>\s*)?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|ERROR|INFO)\]\s*(.*)$/i);
  if (ghMatch) {
    const tag = ghMatch[1].toUpperCase();
    let variant: AlertVariant = "note";
    let color: AlertColor = "purple";
    let icon = "📌";
    let label = "Ghi chú";

    if (tag === "TIP") {
      variant = "tip";
      color = "blue";
      icon = "💡";
      label = "Mẹo";
    } else if (tag === "WARNING") {
      variant = "warning";
      color = "amber";
      icon = "⚠️";
      label = "Cảnh báo";
    } else if (tag === "IMPORTANT" || tag === "CAUTION" || tag === "ERROR") {
      variant = "error";
      color = "red";
      icon = "❗";
      label = "Quan trọng";
    } else if (tag === "INFO") {
      variant = "info";
      color = "blue";
      icon = "ℹ️";
      label = "Thông tin";
    }

    const contentLines: string[] = [];
    if (ghMatch[2]) {
      contentLines.push(ghMatch[2]);
    }

    let i = startIndex + 1;
    const isQuotePrefix = firstLine.startsWith(">");
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (!cur) break;
      if (isQuotePrefix) {
        if (cur.startsWith(">")) {
          contentLines.push(cur.replace(/^>\s?/, ""));
        } else {
          break;
        }
      } else {
        contentLines.push(lines[i]);
      }
      i++;
    }

    const content = contentLines.join("\n").trim();
    return {
      block: {
        type: "alert",
        variant,
        color,
        icon,
        label,
        content,
        tokens: tokenizeInline(content),
      },
      nextIndex: i,
    };
  }

  // 2. Emoji prefix alert
  for (const p of ALERT_PREFIXES) {
    if (firstLine.startsWith(p.icon)) {
      let raw = firstLine.slice(p.icon.length).trim();
      let label = p.label;

      // Extract explicit label like "Cảnh báo: ..." or "**Cảnh báo**:"
      const labelRegex = new RegExp(`^(?:\\*\\*)?${p.label}(?:\\*\\*)?\\s*[:\\-]\\s*(.*)$`, "i");
      const labelMatch = raw.match(labelRegex);
      if (labelMatch) {
        raw = labelMatch[1].trim();
      }

      const content = raw;
      return {
        block: {
          type: "alert",
          variant: p.variant,
          color: p.color,
          icon: p.icon,
          label,
          content,
          tokens: tokenizeInline(content),
        },
        nextIndex: startIndex + 1,
      };
    }
  }

  return null;
}

/**
 * Detects blockquotes (> ...).
 */
export function detectQuote(
  lines: string[],
  startIndex: number,
): { block: QuoteBlock; nextIndex: number } | null {
  const firstLine = lines[startIndex].trim();
  if (!firstLine.startsWith(">")) return null;

  // If it's a GitHub alert, let detectAlert handle it
  if (/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|ERROR|INFO)\]/i.test(firstLine)) {
    return null;
  }

  const quoteLines: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const cur = lines[i].trim();
    if (!cur.startsWith(">")) break;
    quoteLines.push(cur.replace(/^>\s?/, ""));
    i++;
  }

  const text = quoteLines.join("\n");
  return {
    block: {
      type: "quote",
      text,
      lines: quoteLines,
      tokens: tokenizeInline(text),
    },
    nextIndex: i,
  };
}

/**
 * Detects ordered and unordered lists.
 */
export function detectList(
  lines: string[],
  startIndex: number,
): { block: ListBlock; nextIndex: number } | null {
  const firstLine = lines[startIndex];
  const isOrdered = /^\s*\d+\.\s+(.*)/.test(firstLine);
  const isUnordered = /^\s*[-*+]\s+(.*)/.test(firstLine);

  if (!isOrdered && !isUnordered) return null;

  const items: ListItem[] = [];
  let i = startIndex;

  const itemRegex = isOrdered ? /^\s*\d+\.\s+(.*)/ : /^\s*[-*+]\s+(.*)/;

  while (i < lines.length) {
    const match = lines[i].match(itemRegex);
    if (!match) break;
    const raw = match[1];
    items.push({
      raw,
      tokens: tokenizeInline(raw),
    });
    i++;
  }

  return {
    block: {
      type: "list",
      ordered: isOrdered,
      items,
    },
    nextIndex: i,
  };
}

/**
 * Detects standalone JSON objects or arrays.
 */
export function detectJson(
  lines: string[],
  startIndex: number,
): { block: JsonBlock; nextIndex: number } | null {
  const firstLine = lines[startIndex].trim();
  if (!firstLine.startsWith("{") && !firstLine.startsWith("[")) {
    return null;
  }

  // Try collecting lines until closing bracket or EOF
  let buffer = "";
  for (let i = startIndex; i < lines.length; i++) {
    buffer += (i === startIndex ? "" : "\n") + lines[i];
    const trimmed = buffer.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        const data = JSON.parse(trimmed);
        if (typeof data === "object" && data !== null) {
          return {
            block: {
              type: "json",
              data,
              raw: trimmed,
            },
            nextIndex: i + 1,
          };
        }
      } catch {
        // Not valid JSON yet, continue accumulating lines
      }
    }
  }

  return null;
}

/**
 * Parses full message string into structured MessageBlock array.
 */
export function parseMessageBlocks(content: string): MessageBlock[] {
  if (!content) return [];

  const lines = content.split("\n");
  const blocks: MessageBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code fence
    const codeResult = detectCodeBlock(lines, i);
    if (codeResult) {
      blocks.push(codeResult.block);
      i = codeResult.nextIndex;
      continue;
    }

    // 2. Table
    const tableResult = detectTable(lines, i);
    if (tableResult) {
      blocks.push(tableResult.block);
      i = tableResult.nextIndex;
      continue;
    }

    // 3. Alert / Callout
    const alertResult = detectAlert(lines, i);
    if (alertResult) {
      blocks.push(alertResult.block);
      i = alertResult.nextIndex;
      continue;
    }

    // 4. Quote
    const quoteResult = detectQuote(lines, i);
    if (quoteResult) {
      blocks.push(quoteResult.block);
      i = quoteResult.nextIndex;
      continue;
    }

    // 5. List
    const listResult = detectList(lines, i);
    if (listResult) {
      blocks.push(listResult.block);
      i = listResult.nextIndex;
      continue;
    }

    // 6. JSON
    const jsonResult = detectJson(lines, i);
    if (jsonResult) {
      blocks.push(jsonResult.block);
      i = jsonResult.nextIndex;
      continue;
    }

    // 7. Heading
    const headingResult = detectHeading(line);
    if (headingResult) {
      blocks.push(headingResult);
      i++;
      continue;
    }

    // 8. Spacer (empty line)
    if (line.trim() === "") {
      blocks.push({ type: "spacer" });
      i++;
      continue;
    }

    // 9. Regular paragraph
    blocks.push({
      type: "paragraph",
      text: line,
      tokens: tokenizeInline(line),
    });
    i++;
  }

  return blocks;
}
