import React, { useEffect, useRef, useState, useCallback } from "react";
import { useAiStream } from "../../hooks/useAiStream";
import type { AiMessage } from "../../core/ai/types";
import type { WindowState, StreamState } from "./types";
import { WindowHeader } from "./WindowHeader";
import { FloatingChatMessage } from "./FloatingChatMessage";
import type { ToolDevTrace, AiDevTrace } from "../../core/devtools/types";
import { ToolTraceCard } from "../devtools/ToolTraceCard";
import { DebugDetails } from "../devtools/DebugDetails";
import {
  appendReasoning,
  applyDebugUpdate,
} from "../../core/devtools/trace-reducer";
import { useDraggable, useResizable } from "./hooks";

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
      transition:
        state === "minimized"
          ? "width 0.25s ease, height 0.25s ease"
          : "width 0.2s ease, height 0.2s ease",
    };
    return base;
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: "14px 16px",
    fontSize: "13.5px",
    lineHeight: "1.6",
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
  emptyContainer: {
    padding: "16px",
    textAlign: "center" as const,
    color: "#A8A29E",
    fontStyle: "italic",
  },
  errorContainer: {
    padding: "16px",
    textAlign: "center" as const,
    color: "#FCA5A5",
  },
};

export interface FloatingWindowProps {
  initialPosition: { top: number; left: number };
  messages: AiMessage[];
  requestId: string;
  sessionId?: string;
  onClose: () => void;
  toolTrace?: ToolDevTrace;
}

export function FloatingWindow(props: FloatingWindowProps) {
  const [windowState, setWindowState] = useState<WindowState>("default");
  const [streamState, setStreamState] = useState<StreamState>("loading");
  const [responseContent, setResponseContent] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [aiTrace, setAiTrace] = useState<AiDevTrace | undefined>(undefined);

  const containerRef = useRef<HTMLDivElement>(null);

  // Bug [F9]: Store last default position and size before minimize or maximize
  const lastDefaultStateRef = useRef({
    pos: props.initialPosition,
    size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  });

  // Bug [F1]: Resizable hook with unmount cleanup
  const { size, setSize, sizeRef, handleResizeStart } = useResizable({
    initialSize: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    disabled: windowState !== "default",
    containerRef,
  });

  // Clamp position to viewport
  const clampToViewport = useCallback(
    (top: number, left: number, w?: number, h?: number) => {
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      const cw = w ?? size.width;
      const ch = h ?? size.height;
      return {
        top: Math.max(0, Math.min(top, Math.max(0, wh - Math.min(ch, wh)))),
        left: Math.max(0, Math.min(left, Math.max(0, ww - Math.min(cw, ww)))),
      };
    },
    [size.width, size.height],
  );

  // Bug [F1]: Draggable hook with unmount cleanup
  const { pos, setPos, handleMouseDown } = useDraggable({
    initialPosition: props.initialPosition,
    clampToViewport,
    disabled: windowState === "maximized",
  });

  // Bug [F5]: Window resize clamp to keep window within viewport
  useEffect(() => {
    const handleWindowResize = () => {
      setPos((prev) => clampToViewport(prev.top, prev.left));
    };
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [clampToViewport, setPos]);

  // Bug [F7]: Session ID support with fallback
  const fallbackSessionIdRef = useRef<string | null>(null);
  if (!fallbackSessionIdRef.current) {
    fallbackSessionIdRef.current = crypto.randomUUID();
  }
  const effectiveSessionId = props.sessionId ?? fallbackSessionIdRef.current;

  // AI stream via port (shared hook)
  const isDoneRef = useRef(false);

  const { start, stop } = useAiStream({
    onChunk: (delta) => {
      setStreamState("streaming");
      setResponseContent((prev) => prev + delta);
    },
    onDebugStart: (trace) => setAiTrace(trace),
    onReasoning: (delta) => setAiTrace((prev) => (prev ? appendReasoning(prev, delta) : prev)),
    onDebugUpdate: ({ usage, finishReason }) =>
      setAiTrace((prev) => (prev ? applyDebugUpdate(prev, { usage, finishReason }) : prev)),
    onDone: (trace) => {
      isDoneRef.current = true;
      setStreamState("done");
      if (trace) {
        setAiTrace(trace);
      }
    },
    onError: (message, trace) => {
      isDoneRef.current = true;
      setStreamState("error");
      setErrorMessage(message);
      if (trace) {
        setAiTrace(trace);
      }
    },
    onDisconnect: () => {
      if (chrome.runtime.lastError && !isDoneRef.current) {
        setStreamState("error");
        setErrorMessage(chrome.runtime.lastError.message || "Mất kết nối.");
      }
    },
  });

  // Bug [F6]: Stream start effect depends only on requestId, messages, start, stop (avoid toolTrace restarting stream)
  const toolTraceRef = useRef(props.toolTrace);
  toolTraceRef.current = props.toolTrace;

  useEffect(() => {
    isDoneRef.current = false;
    const isDevModeActive = Boolean(toolTraceRef.current);

    start({
      requestId: props.requestId,
      sessionId: effectiveSessionId,
      messages: props.messages,
      ...(isDevModeActive
        ? { devContext: { surface: "floating", feature: "chat" } }
        : {}),
    });

    return () => {
      stop();
    };
  }, [props.requestId, props.messages, effectiveSessionId, start, stop]);

  // Keyboard event handlers
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && windowState === "maximized") {
        setWindowState("default");
        setPos(lastDefaultStateRef.current.pos);
        setSize(lastDefaultStateRef.current.size);
        sizeRef.current = lastDefaultStateRef.current.size;
      }
    },
    [windowState, setPos, setSize, sizeRef],
  );

  // Bug [F2]: Maximize handling with small viewport check
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
    if (window.innerWidth <= 480) {
      containerStyle = {
        ...styles.container("maximized"),
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        borderRadius: 0,
      };
    } else {
      const vw = Math.max(
        MIN_WIDTH,
        Math.min(window.innerWidth * MAXIMIZED_RATIO, 1600),
      );
      const vh = Math.max(
        MIN_HEIGHT,
        Math.min(window.innerHeight * MAXIMIZED_RATIO, 1200),
      );
      containerStyle = {
        ...styles.container("maximized"),
        width: `${vw}px`,
        height: `${vh}px`,
        top: `${Math.max(0, (window.innerHeight - vh) / 2)}px`,
        left: `${Math.max(0, (window.innerWidth - vw) / 2)}px`,
      };
    }
  } else {
    containerStyle = {
      ...styles.container("default"),
      width: `${size.width}px`,
      height: `${size.height}px`,
      top: `${pos.top}px`,
      left: `${pos.left}px`,
    };
  }

  // Bug [F9]: Minimize and restore
  const handleMinimize = () => {
    if (windowState === "minimized") {
      setWindowState("default");
      setPos(lastDefaultStateRef.current.pos);
    } else {
      lastDefaultStateRef.current = { pos, size: sizeRef.current };
      setWindowState("minimized");
    }
  };

  // Bug [F9]: Maximize and restore
  const handleMaximize = useCallback(() => {
    if (windowState === "maximized") {
      setWindowState("default");
      setPos(lastDefaultStateRef.current.pos);
      setSize(lastDefaultStateRef.current.size);
      sizeRef.current = lastDefaultStateRef.current.size;
    } else {
      lastDefaultStateRef.current = { pos, size: sizeRef.current };
      setWindowState("maximized");
    }
  }, [windowState, pos, setPos, setSize, sizeRef]);

  return (
    <div
      style={containerStyle}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      ref={containerRef}
    >
      <WindowHeader
        title={windowState === "minimized" ? "AI" : "AI Assistant"}
        windowState={windowState}
        streamState={streamState}
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
          {streamState === "streaming" && (
            <>
              <FloatingChatMessage
                content={responseContent}
                streamState={streamState}
              />
              {props.toolTrace && (
                <div style={{ marginTop: "12px" }}>
                  <ToolTraceCard trace={props.toolTrace} compact />
                </div>
              )}
            </>
          )}
          {streamState === "done" && (
            <>
              {/* Bug [F8]: Fallback UI when responseContent is empty and streamState === "done" */}
              {responseContent.trim() ? (
                <FloatingChatMessage
                  content={responseContent}
                  streamState={streamState}
                />
              ) : (
                <div
                  style={styles.emptyContainer}
                  className="text-stone-400 italic text-center py-4"
                >
                  Không có phản hồi từ AI. Vui lòng thử lại.
                </div>
              )}
              {props.toolTrace && (
                <div style={{ marginTop: "12px" }}>
                  <ToolTraceCard trace={props.toolTrace} compact />
                </div>
              )}
            </>
          )}
          {streamState === "error" && (
            <>
              <div style={styles.errorContainer}>{errorMessage}</div>
              {props.toolTrace && (
                <div style={{ marginTop: "12px" }}>
                  <ToolTraceCard trace={props.toolTrace} compact />
                </div>
              )}
            </>
          )}
          {aiTrace && (
            <div style={{ marginTop: "12px" }}>
              <DebugDetails trace={aiTrace} compact />
            </div>
          )}
        </div>
      )}
      {/* Resize handle — bottom-right corner */}
      {windowState === "default" && (
        <div
          data-testid="resize-handle"
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
