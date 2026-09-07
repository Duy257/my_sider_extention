import React, { useMemo, useState } from "react";
import type { RenderMode, TableBlock } from "../block-types";
import { tokenizeInline } from "../tokenizer";
import { renderInline } from "./InlineRenderer";

export interface TableBlockRendererProps {
  block: TableBlock;
  mode?: RenderMode;
}

export function TableBlockRenderer({ block, mode = "tailwind" }: TableBlockRendererProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleHeaderClick = (colIndex: number) => {
    if (sortCol === colIndex) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colIndex);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    if (sortCol === null) return block.rows;
    return [...block.rows].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      return sortDir === "asc"
        ? va.localeCompare(vb, "vi", { numeric: true })
        : vb.localeCompare(va, "vi", { numeric: true });
    });
  }, [block.rows, sortCol, sortDir]);

  return (
    <div
      className={
        mode === "tailwind"
          ? "my-3 overflow-x-auto rounded-lg border border-stone-800 bg-stone-950/40"
          : undefined
      }
      style={
        mode === "inline"
          ? {
              margin: "12px 0",
              overflowX: "auto",
              borderRadius: "8px",
              border: "1px solid rgba(68, 64, 60, 0.5)",
              background: "rgba(12, 10, 9, 0.4)",
            }
          : undefined
      }
    >
      <table
        className={mode === "tailwind" ? "w-full text-[13px] border-collapse" : undefined}
        style={mode === "inline" ? { width: "100%", fontSize: "13px", borderCollapse: "collapse" } : undefined}
      >
        <thead>
          <tr
            className={mode === "tailwind" ? "bg-stone-800/60 border-b border-stone-800" : undefined}
            style={
              mode === "inline"
                ? {
                    background: "rgba(41, 37, 36, 0.8)",
                    borderBottom: "1px solid rgba(68, 64, 60, 0.5)",
                  }
                : undefined
            }
          >
            {block.headers.map((header, idx) => {
              const align = block.alignments?.[idx] ?? "left";
              const alignCls =
                align === "center"
                  ? "text-center"
                  : align === "right"
                    ? "text-right"
                    : "text-left";

              return (
                <th
                  key={idx}
                  onClick={() => handleHeaderClick(idx)}
                  className={
                    mode === "tailwind"
                      ? `cursor-pointer px-3 py-2 font-semibold text-stone-300 hover:text-primary-light transition-colors select-none ${alignCls}`
                      : undefined
                  }
                  style={
                    mode === "inline"
                      ? {
                          cursor: "pointer",
                          padding: "8px 12px",
                          fontWeight: 600,
                          color: "#D6D3D1",
                          textAlign: align,
                          userSelect: "none",
                        }
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {renderInline(tokenizeInline(header), mode)}
                    {sortCol === idx ? (sortDir === "asc" ? " ↑" : " ↓") : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className={
                mode === "tailwind"
                  ? "border-t border-stone-800/60 hover:bg-stone-800/30 transition-colors"
                  : undefined
              }
              style={
                mode === "inline"
                  ? {
                      borderTop: "1px solid rgba(68, 64, 60, 0.3)",
                    }
                  : undefined
              }
            >
              {row.map((cell, cIdx) => {
                const align = block.alignments?.[cIdx] ?? "left";
                const alignCls =
                  align === "center"
                    ? "text-center"
                    : align === "right"
                      ? "text-right"
                      : "text-left";

                return (
                  <td
                    key={cIdx}
                    className={
                      mode === "tailwind"
                        ? `px-3 py-1.5 text-stone-200 ${alignCls}`
                        : undefined
                    }
                    style={
                      mode === "inline"
                        ? {
                            padding: "6px 12px",
                            color: "#E7E5E4",
                            textAlign: align,
                          }
                        : undefined
                    }
                  >
                    {renderInline(tokenizeInline(cell), mode)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
