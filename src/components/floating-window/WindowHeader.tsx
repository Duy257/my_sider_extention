import React from "react";
import type { WindowState, StreamState } from "./types";

const styles = {
  header: (dragging: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    background: "#292524",
    borderBottom: "1px solid rgba(68,64,60,0.5)",
    borderRadius: "12px 12px 0 0",
    cursor: dragging ? "move" : "default",
    userSelect: "none",
    flexShrink: 0,
    minHeight: "36px",
  }),
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  icon: {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #8B5CF6, #6366F1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    color: "#fff",
    fontWeight: 700,
  },
  title: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#FAFAF9",
  },
  controls: {
    display: "flex",
    gap: "4px",
  },
  controlBtn: {
    width: "22px",
    height: "22px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: "#A8A29E",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 700,
    padding: 0,
    lineHeight: 1,
    transition: "background 0.15s, color 0.15s",
  } as React.CSSProperties,
};

function ControlButton(props: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      style={styles.controlBtn}
      className="w-[22px] h-[22px] rounded-md border-0 bg-transparent text-stone-400 hover:bg-stone-700/60 hover:text-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 cursor-pointer flex items-center justify-center text-xs font-bold transition-colors duration-150 p-0 leading-none"
      data-window-control="true"
      onClick={props.onClick}
      title={props.label}
      aria-label={props.label}
    >
      {props.children}
    </button>
  );
}

export function getHeaderTitle(
  windowState: WindowState,
  streamState: StreamState | undefined,
  defaultTitle: string,
): string {
  if (windowState === "minimized") {
    return "AI";
  }
  if (streamState === "loading") {
    return "AI đang kết nối...";
  }
  if (streamState === "streaming") {
    return "AI đang trả lời...";
  }
  if (streamState === "error") {
    return "Lỗi phản hồi";
  }
  return defaultTitle;
}

export interface WindowHeaderProps {
  title: string;
  windowState: WindowState;
  streamState?: StreamState;
  dragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export function WindowHeader(props: WindowHeaderProps) {
  const displayTitle = getHeaderTitle(
    props.windowState,
    props.streamState,
    props.title,
  );

  return (
    <div style={styles.header(props.dragging)} onMouseDown={props.onMouseDown}>
      <div style={styles.titleGroup}>
        <div style={styles.icon}>AI</div>
        <span style={styles.title}>{displayTitle}</span>
      </div>
      <div style={styles.controls}>
        <ControlButton label="Thu nhỏ" onClick={props.onMinimize}>
          {props.windowState === "minimized" ? "□" : "—"}
        </ControlButton>
        {props.windowState !== "minimized" && (
          <ControlButton
            label={props.windowState === "maximized" ? "Thu nhỏ" : "Phóng to"}
            onClick={props.onMaximize}
          >
            {props.windowState === "maximized" ? "⤡" : "□"}
          </ControlButton>
        )}
        <ControlButton label="Đóng" onClick={props.onClose}>
          ✕
        </ControlButton>
      </div>
    </div>
  );
}
