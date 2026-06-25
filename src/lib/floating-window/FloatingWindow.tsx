import React, { useEffect, useRef, useState, useCallback } from "react";
import { AI_STREAM_PORT } from "../messaging/ports";
import { buildUserChatMessages } from "../prompts/builders";
import type { AiPortResponse } from "../messaging/types";
import type { WindowState, StreamState } from "./types";
import { WindowHeader } from "./WindowHeader";
import { FloatingChatMessage } from "./FloatingChatMessage";

const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 500;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const MAXIMIZED_RATIO = 0.9;
const MINIMIZED_BAR_HEIGHT = 40;

const styles = {
  container: (state: WindowState): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "fixed",
      zIndex: 2147483646,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      borderRadius: "12px",
      background: "#1C1917",
      color: "#FAFAF9",
      boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)",
      border: "1px solid rgba(68,64,60,0.5)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      transition: state === "minimized" ? "width 0.25s ease, height 0.25s ease" : "width 0.2s ease, height 0.2s ease",
    };
    return base;
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: "12px",
    fontSize: "13.5px",
    lineHeight: "1.6",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "8px",
  },
  loadingDot: (delay: number): React.CSSProperties => ({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#A78BFA",
    animation: "floating-dot-bounce 1.2s ease-in-out infinite",
    animationDelay: `${delay}s`,
  }),
  errorContainer: {
    padding: "16px",
    textAlign: "center" as const,
    color: "#FCA5A5",
  },
};

export function FloatingWindow(props: {
  initialPosition: { top: number; left: number };
  prompt: string;
  requestId: string;
  onClose: () => void;
}) {
  const [windowState, setWindowState] = useState<WindowState>("default");
  const [streamState, setStreamState] = useState<StreamState>("loading");
  const [responseContent, setResponseContent] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Position and size state
  const [pos, setPos] = useState({ top: props.initialPosition.top, left: props.initialPosition.left });
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const defaultPosRef = useRef(props.initialPosition);

  // Drag state
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null);
  // Resize state
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

  // Clamp position to viewport
  const clampToViewport = useCallback((top: number, left: number, w?: number, h?: number) => {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const cw = w ?? size.width;
    const ch = h ?? size.height;
    return {
      top: Math.max(0, Math.min(top, wh - Math.min(ch, wh))),
      left: Math.max(0, Math.min(left, ww - Math.min(cw, ww))),
    };
  }, [size]);

  // AI stream via port
  useEffect(() => {
    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: AI_STREAM_PORT });
    } catch {
      setStreamState("error");
      setErrorMessage("Không thể kết nối dịch vụ AI.");
      return;
    }

    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError && streamState !== "done") {
        setStreamState("error");
        setErrorMessage(chrome.runtime.lastError.message || "Mất kết nối.");
      }
    });

    port.onMessage.addListener((message: AiPortResponse) => {
      if (message.requestId !== props.requestId) return;

      if (message.type === "AI_STREAM_CHUNK") {
        setStreamState("streaming");
        setResponseContent((prev) => prev + message.delta);
      }

      if (message.type === "AI_STREAM_DONE") {
        setStreamState("done");
        port.disconnect();
      }

      if (message.type === "AI_STREAM_ERROR") {
        setStreamState("error");
        setErrorMessage(message.message);
        port.disconnect();
      }
    });

    port.postMessage({
      type: "AI_CHAT_REQUEST",
      requestId: props.requestId,
      messages: buildUserChatMessages(props.prompt),
    });

    return () => {
      try { port.disconnect(); } catch {}
    };
  }, [props.requestId, props.prompt, streamState]);

  // Keyboard event handlers
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape" && windowState === "maximized") {
      setWindowState("default");
    }
  }, [windowState]);

  // Mouse event handlers for drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (windowState === "maximized") return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-window-control]")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTop: pos.top, startLeft: pos.left };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const newTop = dragRef.current.startTop + dy;
      const newLeft = dragRef.current.startLeft + dx;
      const clamped = clampToViewport(newTop, newLeft);
      setPos(clamped);
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [pos, windowState, clampToViewport]);

  // Mouse event handlers for resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (windowState !== "default") return;
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startWidth: size.width, startHeight: size.height };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const newWidth = Math.max(MIN_WIDTH, resizeRef.current.startWidth + (ev.clientX - resizeRef.current.startX));
      const newHeight = Math.max(MIN_HEIGHT, resizeRef.current.startHeight + (ev.clientY - resizeRef.current.startY));
      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [size, windowState]);

  // Compute container styles
  let containerStyle: React.CSSProperties;
  if (windowState === "minimized") {
    containerStyle = {
      ...styles.container("minimized"),
      width: "180px",
      height: `${MINIMIZED_BAR_HEIGHT}px`,
      right: "0",
      top: "50%",
      transform: "translateY(-50%)",
      left: "auto",
      cursor: "pointer",
      borderRadius: "8px 0 0 8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    };
  } else if (windowState === "maximized") {
    const vw = window.innerWidth * MAXIMIZED_RATIO;
    const vh = window.innerHeight * MAXIMIZED_RATIO;
    containerStyle = {
      ...styles.container("maximized"),
      width: `${vw}px`,
      height: `${vh}px`,
      top: `${(window.innerHeight - vh) / 2}px`,
      left: `${(window.innerWidth - vw) / 2}px`,
    };
  } else {
    containerStyle = {
      ...styles.container("default"),
      width: `${size.width}px`,
      height: `${size.height}px`,
      top: `${pos.top}px`,
      left: `${pos.left}px`,
    };
  }

  const handleMinimize = () => {
    if (windowState === "minimized") {
      setWindowState("default");
      setPos(defaultPosRef.current);
    } else {
      setWindowState("minimized");
    }
  };

  const handleMaximize = () => {
    if (windowState === "maximized") {
      setWindowState("default");
      setPos(defaultPosRef.current);
      setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    } else {
      setWindowState("maximized");
    }
  };

  return (
    <div style={containerStyle} onKeyDown={handleKeyDown} tabIndex={0}>
      <WindowHeader
        title={windowState === "minimized" ? "AI" : "AI Assistant"}
        windowState={windowState}
        dragging={windowState !== "maximized"}
        onMouseDown={handleMouseDown}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onClose={props.onClose}
      />
      {windowState !== "minimized" && (
        <div style={styles.body}>
          {streamState === "loading" && (
            <div style={styles.loadingContainer}>
              <div style={styles.loadingDot(0)} />
              <div style={styles.loadingDot(0.2)} />
              <div style={styles.loadingDot(0.4)} />
            </div>
          )}
          {(streamState === "streaming" || streamState === "done") && (
            <FloatingChatMessage content={responseContent} streamState={streamState} />
          )}
          {streamState === "error" && (
            <div style={styles.errorContainer}>{errorMessage}</div>
          )}
        </div>
      )}
      {/* Resize handle — bottom-right corner */}
      {windowState === "default" && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: "12px",
            height: "12px",
            cursor: "nwse-resize",
            background: "transparent",
          }}
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  );
}
