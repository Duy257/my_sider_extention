import React from "react";
import type { WindowState } from "./types";

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
  controlBtn: (hover: boolean): React.CSSProperties => ({
    width: "22px",
    height: "22px",
    borderRadius: "6px",
    border: "none",
    background: hover ? "#3C3833" : "transparent",
    color: "#A8A29E",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 700,
    transition: "background 0.15s",
    padding: 0,
    lineHeight: 1,
  }),
};

function ControlButton(props: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      style={styles.controlBtn(hover)}
      data-window-control="true"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={props.onClick}
      title={props.label}
    >
      {props.children}
    </button>
  );
}

export function WindowHeader(props: {
  title: string;
  windowState: WindowState;
  dragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}) {
  return (
    <div style={styles.header(props.dragging)} onMouseDown={props.onMouseDown}>
      <div style={styles.titleGroup}>
        <div style={styles.icon}>AI</div>
        <span style={styles.title}>
          {props.windowState === "minimized" ? "AI" : props.title}
        </span>
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
