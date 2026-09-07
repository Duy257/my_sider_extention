import React from "react";
import type { AlertBlock, AlertVariant, RenderMode } from "../block-types";
import { renderInline } from "./InlineRenderer";

export interface AlertBlockRendererProps {
  block: AlertBlock;
  mode?: RenderMode;
}

const ALERT_CONFIG: Record<
  AlertVariant,
  {
    tailwind: string;
    inlineBorder: string;
    inlineBg: string;
    inlineColor: string;
    defaultIcon: string;
    defaultLabel: string;
  }
> = {
  warning: {
    tailwind: "border-amber-500/60 bg-amber-950/25 text-amber-200",
    inlineBorder: "rgba(245, 158, 11, 0.6)",
    inlineBg: "rgba(120, 53, 15, 0.25)",
    inlineColor: "#FDE68A",
    defaultIcon: "⚠️",
    defaultLabel: "Cảnh báo",
  },
  error: {
    tailwind: "border-red-500/60 bg-red-950/25 text-red-200",
    inlineBorder: "rgba(239, 68, 68, 0.6)",
    inlineBg: "rgba(127, 29, 29, 0.25)",
    inlineColor: "#FECACA",
    defaultIcon: "❗",
    defaultLabel: "Lỗi",
  },
  tip: {
    tailwind: "border-blue-500/60 bg-blue-950/25 text-blue-200",
    inlineBorder: "rgba(59, 130, 246, 0.6)",
    inlineBg: "rgba(30, 58, 138, 0.25)",
    inlineColor: "#BFDBFE",
    defaultIcon: "💡",
    defaultLabel: "Mẹo",
  },
  info: {
    tailwind: "border-sky-500/60 bg-sky-950/25 text-sky-200",
    inlineBorder: "rgba(14, 165, 233, 0.6)",
    inlineBg: "rgba(12, 74, 110, 0.25)",
    inlineColor: "#BAE6FD",
    defaultIcon: "ℹ️",
    defaultLabel: "Thông tin",
  },
  note: {
    tailwind: "border-violet-500/60 bg-violet-950/25 text-violet-200",
    inlineBorder: "rgba(139, 92, 246, 0.6)",
    inlineBg: "rgba(76, 29, 149, 0.25)",
    inlineColor: "#DDD6FE",
    defaultIcon: "📌",
    defaultLabel: "Ghi chú",
  },
  success: {
    tailwind: "border-emerald-500/60 bg-emerald-950/25 text-emerald-200",
    inlineBorder: "rgba(16, 185, 129, 0.6)",
    inlineBg: "rgba(6, 78, 59, 0.25)",
    inlineColor: "#A7F3D0",
    defaultIcon: "✅",
    defaultLabel: "Thành công",
  },
};

export function AlertBlockRenderer({ block, mode = "tailwind" }: AlertBlockRendererProps) {
  const config = ALERT_CONFIG[block.variant] || ALERT_CONFIG.info;
  const icon = block.icon || config.defaultIcon;
  const label = block.label || config.defaultLabel;

  return (
    <div
      role="alert"
      className={
        mode === "tailwind"
          ? `my-3 rounded-lg border-l-4 p-3.5 text-[13px] leading-relaxed ${config.tailwind}`
          : undefined
      }
      style={
        mode === "inline"
          ? {
              margin: "12px 0",
              borderRadius: "6px",
              borderLeft: `4px solid ${config.inlineBorder}`,
              background: config.inlineBg,
              color: config.inlineColor,
              padding: "10px 14px",
              fontSize: "13px",
              lineHeight: "1.6",
            }
          : undefined
      }
    >
      <div
        className={
          mode === "tailwind"
            ? "flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider mb-1 opacity-90 select-none"
            : undefined
        }
        style={
          mode === "inline"
            ? {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 600,
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "4px",
                opacity: 0.9,
                userSelect: "none",
              }
            : undefined
        }
      >
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div>{renderInline(block.tokens, mode)}</div>
    </div>
  );
}
