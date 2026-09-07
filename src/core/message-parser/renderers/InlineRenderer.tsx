import React from "react";
import type { InlineToken, RenderMode } from "../block-types";

export function renderInlineToken(
  token: InlineToken,
  index: number,
  mode: RenderMode = "tailwind",
): React.ReactNode {
  switch (token.type) {
    case "bold":
      return (
        <strong
          key={index}
          className={mode === "tailwind" ? "font-bold text-stone-50" : undefined}
          style={mode === "inline" ? { fontWeight: 700, color: "#FAFAF9" } : undefined}
        >
          {token.text}
        </strong>
      );

    case "italic":
      return (
        <em
          key={index}
          className={mode === "tailwind" ? "italic text-stone-200" : undefined}
          style={mode === "inline" ? { fontStyle: "italic", color: "#D6D3D1" } : undefined}
        >
          {token.text}
        </em>
      );

    case "bold-italic":
      return (
        <strong
          key={index}
          className={mode === "tailwind" ? "font-bold text-stone-50" : undefined}
          style={mode === "inline" ? { fontWeight: 700, color: "#FAFAF9" } : undefined}
        >
          <em
            className={mode === "tailwind" ? "italic text-stone-200" : undefined}
            style={mode === "inline" ? { fontStyle: "italic", color: "#D6D3D1" } : undefined}
          >
            {token.text}
          </em>
        </strong>
      );

    case "code":
      return (
        <code
          key={index}
          className={
            mode === "tailwind"
              ? "rounded px-1.5 py-0.5 text-xs font-mono text-pink-400 bg-stone-900 border border-stone-800"
              : undefined
          }
          style={
            mode === "inline"
              ? {
                  background: "#292524",
                  color: "#F472B6",
                  padding: "2px 5px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontFamily: "Consolas, Monaco, monospace",
                  border: "1px solid rgba(244, 114, 182, 0.15)",
                }
              : undefined
          }
        >
          {token.text}
        </code>
      );

    case "link": {
      const isSafe = /^https?:\/\//i.test(token.url) || token.url.startsWith("#");
      return (
        <a
          key={index}
          href={isSafe ? token.url : "#"}
          target={token.url.startsWith("#") ? undefined : "_blank"}
          rel={token.url.startsWith("#") ? undefined : "noreferrer noopener"}
          className={
            mode === "tailwind"
              ? "text-primary-light hover:underline underline-offset-2"
              : undefined
          }
          style={
            mode === "inline"
              ? {
                  color: "#A78BFA",
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                }
              : undefined
          }
        >
          {token.text || token.url}
        </a>
      );
    }

    case "text":
    default:
      return <React.Fragment key={index}>{token.text}</React.Fragment>;
  }
}

export function renderInline(
  tokens: InlineToken[],
  mode: RenderMode = "tailwind",
): React.ReactNode[] {
  return tokens.map((tok, idx) => renderInlineToken(tok, idx, mode));
}
