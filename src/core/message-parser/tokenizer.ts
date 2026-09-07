import type { InlineToken } from "./block-types";

/**
 * Searches for an unescaped delimiter starting from start index.
 */
function findClosing(
  text: string,
  delim: string,
  start: number,
  options?: {
    disallowPrecedingSpace?: boolean;
    requireExactLength?: boolean;
  },
): number {
  let pos = start;
  const dLen = delim.length;

  while (pos < text.length) {
    const idx = text.indexOf(delim, pos);
    if (idx === -1) return -1;

    // Check if escaped: count consecutive preceding backslashes
    let backslashes = 0;
    let b = idx - 1;
    while (b >= 0 && text[b] === "\\") {
      backslashes++;
      b--;
    }
    if (backslashes % 2 === 1) {
      pos = idx + dLen;
      continue;
    }

    // If disallowPrecedingSpace, closing token cannot be preceded by whitespace
    if (
      options?.disallowPrecedingSpace &&
      idx > start &&
      (text[idx - 1] === " " || text[idx - 1] === "\t" || text[idx - 1] === "\n")
    ) {
      pos = idx + dLen;
      continue;
    }

    // If delimiter is single '*', make sure next char is not '*'
    if (dLen === 1 && delim === "*" && text[idx + 1] === "*") {
      pos = idx + 1;
      continue;
    }

    // If delimiter is '**', make sure next char is not '*'
    if (dLen === 2 && delim === "**" && text[idx + 2] === "*") {
      pos = idx + 1;
      continue;
    }

    return idx;
  }

  return -1;
}

/**
 * Single-pass inline tokenizer for markdown text.
 * Fixes [C2] (* vs ** vs ***, escaped \*, inline code, link [label](url)).
 */
export function tokenizeInline(text: string): InlineToken[] {
  if (!text) return [];

  const tokens: InlineToken[] = [];
  let textBuffer = "";
  const len = text.length;
  let i = 0;

  const flushText = () => {
    if (textBuffer.length > 0) {
      tokens.push({ type: "text", text: textBuffer });
      textBuffer = "";
    }
  };

  while (i < len) {
    // 1. Escaped character: \* or \` or \[ etc.
    if (text[i] === "\\") {
      if (i + 1 < len && /[*_`[\]()\\]/.test(text[i + 1])) {
        textBuffer += text[i + 1];
        i += 2;
        continue;
      }
      textBuffer += "\\";
      i++;
      continue;
    }

    // 2. Bold + Italic: ***text***
    if (text.startsWith("***", i)) {
      const nextChar = text[i + 3];
      if (nextChar && nextChar !== " " && nextChar !== "\t" && nextChar !== "\n") {
        const close = findClosing(text, "***", i + 3, { disallowPrecedingSpace: true });
        if (close !== -1 && close > i + 3) {
          flushText();
          tokens.push({
            type: "bold-italic",
            text: text.slice(i + 3, close),
          });
          i = close + 3;
          continue;
        }
      }
    }

    // 3. Bold: **text**
    if (text.startsWith("**", i)) {
      const nextChar = text[i + 2];
      if (nextChar && nextChar !== " " && nextChar !== "\t" && nextChar !== "\n") {
        const close = findClosing(text, "**", i + 2, { disallowPrecedingSpace: true });
        if (close !== -1 && close > i + 2) {
          flushText();
          tokens.push({
            type: "bold",
            text: text.slice(i + 2, close),
          });
          i = close + 2;
          continue;
        }
      }
    }

    // 4. Italic: *text* (single asterisk, not followed by asterisk)
    if (text[i] === "*" && text[i + 1] !== "*") {
      const nextChar = text[i + 1];
      if (nextChar && nextChar !== " " && nextChar !== "\t" && nextChar !== "\n") {
        const close = findClosing(text, "*", i + 1, { disallowPrecedingSpace: true });
        if (close !== -1 && close > i + 1) {
          flushText();
          tokens.push({
            type: "italic",
            text: text.slice(i + 1, close),
          });
          i = close + 1;
          continue;
        }
      }
    }

    // 5. Inline code: `code`
    if (text[i] === "`") {
      const close = text.indexOf("`", i + 1);
      if (close !== -1 && close > i + 1) {
        flushText();
        tokens.push({
          type: "code",
          text: text.slice(i + 1, close),
        });
        i = close + 1;
        continue;
      }
    }

    // 6. Link: [label](url)
    if (text[i] === "[") {
      const closeBracket = findClosing(text, "]", i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === "(") {
        const closeParen = findClosing(text, ")", closeBracket + 2);
        if (closeParen !== -1) {
          const label = text.slice(i + 1, closeBracket);
          const url = text.slice(closeBracket + 2, closeParen).trim();
          flushText();
          tokens.push({
            type: "link",
            text: label,
            url,
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // 7. Regular character
    textBuffer += text[i];
    i++;
  }

  flushText();
  return tokens;
}
