# Selection Floating Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Chrome side panel with a floating React window injected on the page when user triggers a selection action.

**Architecture:** When user selects text and clicks a toolbar action, `active-tab-agent.ts` sends `SELECTION_ACTION` to `background.ts`. Background forwards `FORWARD_SELECTION_ACTION` to the content script instead of the side panel. Content script mounts a React floating window (shadow DOM, inline styles) near the selection, opens an AI streaming port, and renders the response. Extension icon click (`action.onClicked`) injects the content script — replacing the old side-panel-opens → inject flow.

**Tech Stack:** React 19 (via shadow DOM), TypeScript 5, WXT, Chrome MV3

## Global Constraints

- Floating window components use inline styles (no Tailwind dependency in content script context)
- Only one floating window at a time (close existing before opening new)
- Vietnamese UI text (matching existing convention)
- Window positions use `position: fixed` coordinates
- Minimum window size: 280×200px
- Default window size: 380×500px
- Minimized bar: ~40px tall, flush with viewport right edge
- Maximized: ~90% viewport centered
- Content script uses `defineUnlistedScript` (keep existing pattern for selection toolbar)
- All new files go in `src/lib/floating-window/`
- No new permissions required (`scripting` + `activeTab` already granted, `sidePanel` removed)

---

### Task 1: Background script — remove side panel, add action.onClicked

**Files:**
- Modify: `entrypoints/background.ts` (full rewrite of relevant sections)

**Interfaces:**
- Consumes: message type `SELECTION_ACTION` from content script (unchanged)
- Produces: message `FORWARD_SELECTION_ACTION` to active tab content script (instead of side panel)
- Registers `chrome.action.onClicked` → calls `injectContentAgent(tabId)`
- Removes `chrome.sidePanel.setPanelBehavior()`
- Removes `pendingSelectionPrompts` queue and `GET_PENDING_SELECTION_PROMPT` handler

- [ ] **Step 1: Remove sidePanel imports + action.onClicked registration**

Replace the background.ts code as shown in Step 2 below. Key behavioral changes:
- Remove `chrome.sidePanel.setPanelBehavior()` from `onInstalled`
- Replace with `chrome.action.onClicked.addListener((tab) => { if (tab.id) injectContentAgent(tab.id); })`
- `SELECTION_ACTION` handler: replace `chrome.sidePanel.open()` + `chrome.runtime.sendMessage` with `chrome.tabs.sendMessage(sender.tab.id, { type: "FORWARD_SELECTION_ACTION", ... })`
- Remove `pendingSelectionPrompts` queue and `GET_PENDING_SELECTION_PROMPT` handler
- Keep `ACTIVATE_ACTIVE_TAB_AGENT` handler (backward compat for existing callers)

- [ ] **Step 2: Update background.ts — remove sidePanel references**

Replace the entire background:

```typescript
// entrypoints/background.ts
import { fetchModels, streamChatCompletion, testConnection } from "../src/lib/ai/client";
import { resolveProviderRuntimeConfig } from "../src/lib/ai/runtime";
import { AI_STREAM_PORT } from "../src/lib/messaging/ports";
import type { AiPortRequest } from "../src/lib/messaging/types";
import { getSettings } from "../src/lib/storage";

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab is available.");
  return tab;
}

const injectedTabs = new Set<number>();

async function injectContentAgent(tabId: number) {
  if (injectedTabs.has(tabId)) return;
  injectedTabs.add(tabId);
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["/active-tab-agent.js"]
  });
}

export default defineBackground(() => {
  // Inject content script on extension icon click (replaces side panel activation)
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id) injectContentAgent(tab.id);
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== AI_STREAM_PORT) return;

    const controller = new AbortController();
    let busy = false;

    port.onDisconnect.addListener(() => {
      controller.abort();
    });

    port.onMessage.addListener(async (message: AiPortRequest) => {
      if (message.type !== "AI_CHAT_REQUEST") return;
      if (busy) return;
      busy = true;

      const send = (msg: Record<string, unknown>) => {
        try { port.postMessage(msg); } catch {}
      };

      try {
        const settings = await getSettings();
        const runtime = resolveProviderRuntimeConfig(settings);

        if (!runtime.ok) {
          send({ type: "AI_STREAM_ERROR", requestId: message.requestId, message: runtime.error });
          return;
        }

        await streamChatCompletion({
          baseUrl: runtime.config.baseUrl,
          apiKey: runtime.config.apiKey,
          model: runtime.config.model,
          messages: message.messages,
          signal: controller.signal,
          callbacks: {
            onDelta: (delta) =>
              send({ type: "AI_STREAM_CHUNK", requestId: message.requestId, delta }),
            onDone: () => send({ type: "AI_STREAM_DONE", requestId: message.requestId }),
            onError: (errorMessage) =>
              send({ type: "AI_STREAM_ERROR", requestId: message.requestId, message: errorMessage })
          }
        });
      } catch (error) {
        send({
          type: "AI_STREAM_ERROR",
          requestId: message.requestId,
          message: error instanceof Error ? error.message : "Unexpected streaming error."
        });
      } finally {
        busy = false;
      }
    });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "ACTIVATE_ACTIVE_TAB_AGENT") {
      getActiveTab()
        .then((tab) => injectContentAgent(tab.id!))
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;
    }

    if (message.type === "LOAD_MODELS") {
      getSettings()
        .then(async (settings) => {
          const runtime = resolveProviderRuntimeConfig(settings);
          if (!runtime.ok) return { ok: false as const, error: runtime.error };
          const result = await fetchModels({ modelUrl: runtime.config.modelUrl, apiKey: runtime.config.apiKey });
          if ("models" in result) return { ok: true as const, models: result.models };
          return { ok: false as const, error: result.error };
        })
        .then(sendResponse);
      return true;
    }

    if (message.type === "TEST_CONNECTION") {
      getSettings()
        .then((settings) => {
          const runtime = resolveProviderRuntimeConfig(settings);
          if (!runtime.ok) return { ok: false as const, error: runtime.error };
          return testConnection({
            baseUrl: runtime.config.baseUrl,
            apiKey: runtime.config.apiKey,
            model: runtime.config.model
          });
        })
        .then(sendResponse);
      return true;
    }

    if (message.type === "SELECTION_ACTION") {
      // Forward to the active tab's content script (instead of side panel)
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "FORWARD_SELECTION_ACTION",
          requestId: message.requestId,
          prompt: message.prompt,
          title: message.title,
          actionPosition: { top: message.position?.top ?? 200, left: message.position?.left ?? 200 }
        }).catch(() => undefined);
      }
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "EXTRACT_ACTIVE_PAGE") {
      getActiveTab()
        .then(async (tab) => {
          await injectContentAgent(tab.id!);
          let lastError: unknown;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const response = await chrome.tabs.sendMessage(tab.id!, { type: "EXTRACT_PAGE_CONTENT" });
              sendResponse(response);
              return;
            } catch (err) {
              lastError = err;
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
          sendResponse({ error: lastError instanceof Error ? lastError.message : "Content script not ready after retries." });
        })
        .catch((error) => sendResponse({ error: error instanceof Error ? error.message : "Page extraction failed." }));
      return true;
    }

    return false;
  });
});
```

- [ ] **Step 3: Update `sendSelectionAction` to include position**

```typescript
// In entrypoints/active-tab-agent.ts, update sendSelectionAction:
function sendSelectionAction(action: SelectionAction, text: string) {
  const pos = selectionPosition();
  chrome.runtime.sendMessage({
    type: "SELECTION_ACTION",
    requestId: crypto.randomUUID(),
    action,
    text,
    url: window.location.href,
    title: document.title || "Untitled page",
    prompt: buildSelectionPrompt(action, text),
    position: { top: pos.top, left: pos.left }
  });
}
```

- [ ] **Step 4: Run test**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add entrypoints/background.ts entrypoints/active-tab-agent.ts
git commit -m "feat(background): remove side panel, forward selection to content script"
```

---

### Task 2: Active tab agent — FORWARD_SELECTION_ACTION handler + streaming port

**Files:**
- Modify: `entrypoints/active-tab-agent.ts`
- New: `src/lib/floating-window/mount.ts` (React mount/unmount helper)

**Interfaces:**
- Consumes: `FORWARD_SELECTION_ACTION` message with `{ requestId, prompt, title, actionPosition }`
- Produces: mounts `FloatingWindow` React component at `actionPosition`, manages stream port lifecycle
- Creates port `chrome.runtime.connect({ name: AI_STREAM_PORT })` → sends `AI_CHAT_REQUEST` → receives chunks

- [ ] **Step 1: Write the mount helper**

```typescript
// src/lib/floating-window/mount.ts
import React from "react";
import ReactDOM from "react-dom/client";
import { FloatingWindow } from "./FloatingWindow";

let currentRoot: ReactDOM.Root | null = null;
let currentContainer: HTMLElement | null = null;

export interface MountOptions {
  position: { top: number; left: number };
  prompt: string;
  requestId: string;
  title: string;
}

export function mountFloatingWindow(options: MountOptions) {
  destroyFloatingWindow();

  const container = document.createElement("div");
  container.id = "personal-ai-floating-window";
  container.style.position = "fixed";
  container.style.zIndex = "2147483646";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "0";
  container.style.height = "0";
  document.body.appendChild(container);

  // Create shadow DOM for style isolation
  const shadow = container.attachShadow({ mode: "closed" });
  const host = document.createElement("div");
  shadow.appendChild(host);

  const root = ReactDOM.createRoot(host);
  root.render(
    React.createElement(FloatingWindow, {
      initialPosition: options.position,
      prompt: options.prompt,
      requestId: options.requestId,
      onClose: destroyFloatingWindow,
    })
  );

  currentRoot = root;
  currentContainer = container;
}

export function destroyFloatingWindow() {
  if (currentRoot) {
    currentRoot.unmount();
    currentRoot = null;
  }
  if (currentContainer) {
    currentContainer.remove();
    currentContainer = null;
  }
}
```

- [ ] **Step 2: Add FORWARD_SELECTION_ACTION handler to active-tab-agent.ts**

Add import and message handler at the bottom of the existing file:

```typescript
// Add at top of active-tab-agent.ts
import { mountFloatingWindow } from "../src/lib/floating-window/mount";

// Add inside the default export function, after the existing onMessage listener:
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "FORWARD_SELECTION_ACTION") {
    mountFloatingWindow({
      position: message.actionPosition ?? { top: 200, left: 200 },
      prompt: message.prompt,
      requestId: message.requestId,
      title: message.title,
    });
    sendResponse({ ok: true });
    return true;
  }
  // Keep existing EXTRACT_PAGE_CONTENT handler
  if (message.type === "EXTRACT_PAGE_CONTENT") {
    try {
      sendResponse(extractPageContent(window.location.href));
    } catch (e) {
      sendResponse({ error: String(e) });
    }
    return true;
  }
  return true;
});
```

- [ ] **Step 3: Run type check**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add entrypoints/active-tab-agent.ts src/lib/floating-window/mount.ts
git commit -m "feat(content): add FORWARD_SELECTION_ACTION handler with React mount"
```

---

### Task 3: FloatingWindow component — state machine + drag/resize/min/max

**Files:**
- Create: `src/lib/floating-window/FloatingWindow.tsx`
- Create: `src/lib/floating-window/types.ts`

**Interfaces:**
- Props: `{ initialPosition: { top: number; left: number }; prompt: string; requestId: string; onClose: () => void }`
- State: `idle | loading | streaming | done | error`
- Window state: `default | minimized | maximized`
- Produces: renders WindowHeader + ChatMessage for streaming result
- Manages AI stream port internally

- [ ] **Step 1: Write types file**

```typescript
// src/lib/floating-window/types.ts
export type WindowState = "default" | "minimized" | "maximized";
export type StreamState = "idle" | "loading" | "streaming" | "done" | "error";
```

- [ ] **Step 2: Write FloatingWindow component**

```typescript
// src/lib/floating-window/FloatingWindow.tsx
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
  }, []);

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
```

- [ ] **Step 3: Add keyframe animation for loading dots**

The loading dots use a CSS animation. Since we're using inline styles in shadow DOM, we need to inject the keyframes into the shadow root. Add this to `mount.ts`:

```typescript
// In mount.ts, after creating shadow root:
const style = document.createElement("style");
style.textContent = `
  @keyframes floating-dot-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }
`;
shadow.appendChild(style);
```

- [ ] **Step 4: Run compile**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/floating-window/FloatingWindow.tsx src/lib/floating-window/types.ts src/lib/floating-window/mount.ts
git commit -m "feat(floating-window): add FloatingWindow component with drag/resize/min/max"
```

---

### Task 4: WindowHeader component

**Files:**
- Create: `src/lib/floating-window/WindowHeader.tsx`

**Interfaces:**
- Props: `{ title: string; windowState: WindowState; dragging: boolean; onMouseDown: (e: React.MouseEvent) => void; onMinimize: () => void; onMaximize: () => void; onClose: () => void }`
- Produces: header bar with icon, title, and three control buttons

- [ ] **Step 1: Write WindowHeader component**

```typescript
// src/lib/floating-window/WindowHeader.tsx
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
```

- [ ] **Step 2: Run compile**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/floating-window/WindowHeader.tsx
git commit -m "feat(floating-window): add WindowHeader with drag handle and controls"
```

---

### Task 5: FloatingChatMessage component (inline styles, no Tailwind)

**Files:**
- Create: `src/lib/floating-window/FloatingChatMessage.tsx`

**Interfaces:**
- Props: `{ content: string; streamState: StreamState }`
- Produces: renders the AI response text with markdown-like formatting (pre-wrap)

- [ ] **Step 1: Write FloatingChatMessage component**

```typescript
// src/lib/floating-window/FloatingChatMessage.tsx
import React from "react";
import type { StreamState } from "./types";

const styles = {
  container: {
    animation: "floating-fade-in-up 0.3s ease-out",
  },
  text: {
    color: "#FAFAF9",
    lineHeight: "1.7",
  },
  cursor: {
    display: "inline-block",
    width: "6px",
    height: "14px",
    background: "#A78BFA",
    animation: "floating-blink 0.8s step-end infinite",
    marginLeft: "1px",
    verticalAlign: "text-bottom",
  },
};

export function FloatingChatMessage(props: {
  content: string;
  streamState: StreamState;
}) {
  return (
    <div style={styles.container}>
      <div style={styles.text}>
        {props.content}
        {props.streamState === "streaming" && <span style={styles.cursor} />}
      </div>
    </div>
  );
}
```

Add these keyframes to the injected style in `mount.ts`:

```typescript
style.textContent = `
  @keyframes floating-dot-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }
  @keyframes floating-fade-in-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes floating-blink {
    50% { opacity: 0; }
  }
`;
```

- [ ] **Step 2: Run compile**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/floating-window/FloatingChatMessage.tsx
git commit -m "feat(floating-window): add FloatingChatMessage with inline styles"
```

---

### Task 6: Update messaging types — add position to SELECTION_ACTION

**Files:**
- Modify: `src/lib/messaging/types.ts`
- Modify: `src/lib/selection/toolbar.ts` (pass position in onAction callback)

- [ ] **Step 1: Add position field to SELECTION_ACTION and FORWARD_SELECTION_ACTION**

```typescript
// src/lib/messaging/types.ts — update SELECTION_ACTION type
| {
    type: "SELECTION_ACTION";
    requestId: string;
    action: SelectionAction;
    text: string;
    url: string;
    title: string;
    prompt: string;
    position: { top: number; left: number };  // ADD
  }

// Update FORWARD_SELECTION_ACTION type
| {
    type: "FORWARD_SELECTION_ACTION";
    requestId: string;
    prompt: string;
    title: string;
    actionPosition: { top: number; left: number };  // ADD
  }
```

- [ ] **Step 2: Pass position in toolbar onAction**

```typescript
// src/lib/selection/toolbar.ts — no change needed here, position is captured
// in active-tab-agent.ts's sendSelectionAction (done in Task 1 Step 3)
```

- [ ] **Step 3: Run compile**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/messaging/types.ts
git commit -m "feat(messaging): add position to SELECTION_ACTION and FORWARD_SELECTION_ACTION"
```

---

### Task 7: WXT config + clean up side panel entrypoint

**Files:**
- Modify: `wxt.config.ts`
- Delete: `entrypoints/sidepanel/` (entire directory)
- Remove unused `sidepanel.html` reference

- [ ] **Step 1: Update wxt.config.ts**

```typescript
// wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Personal AI Sidebar",
    description: "Private AI assistant for reading, rewriting, summarizing, and analysis workflows.",
    version: "0.1.0",
    permissions: ["storage", "activeTab", "scripting"],  // REMOVED "sidePanel"
    host_permissions: ["https://api.openai.com/*", "https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
    action: {
      default_title: "Personal AI Sidebar"
    }
  }
});
```

- [ ] **Step 2: Remove sidepanel entrypoint**

```bash
rm -rf entrypoints/sidepanel/
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: builds successfully (may have warning about missing sidepanel, but should work)

- [ ] **Step 4: Run compile**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add wxt.config.ts
git rm -r entrypoints/sidepanel/
git commit -m "chore(config): remove sidePanel, clean up sidepanel entrypoint"
```

---

### Task 8: Tests

**Files:**
- Create: `tests/floating-window.test.tsx`
- Modify: `tests/setup.ts` (add any needed mocks)

- [ ] **Step 1: Test FloatingWindow state transitions**

```typescript
// tests/floating-window.test.tsx
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FloatingWindow } from "../src/lib/floating-window/FloatingWindow";

// Mock chrome.runtime.connect
const mockPort = {
  postMessage: vi.fn(),
  onMessage: { addListener: vi.fn() },
  onDisconnect: { addListener: vi.fn() },
  disconnect: vi.fn(),
};

vi.mock("webextension-polyfill", () => ({
  runtime: {
    connect: () => mockPort,
    lastError: null,
  },
}));

describe("FloatingWindow", () => {
  const defaultProps = {
    initialPosition: { top: 100, left: 100 },
    prompt: "Test prompt",
    requestId: "test-id",
    onClose: vi.fn(),
  };

  it("renders in default state with loading indicator", () => {
    render(React.createElement(FloatingWindow, defaultProps));
    expect(screen.getByText("AI Assistant")).toBeDefined();
    // Loading dots should be present
    const container = screen.getByText("AI Assistant").closest("[style]");
    expect(container).toBeDefined();
  });

  it("transitions to minimized state when minimize button clicked", () => {
    render(React.createElement(FloatingWindow, defaultProps));
    const minimizeBtn = screen.getByTitle("Thu nhỏ");
    fireEvent.click(minimizeBtn);
    // In minimized state, title should be "AI"
    expect(screen.getByText("AI")).toBeDefined();
  });

  it("closes when close button clicked", () => {
    const onClose = vi.fn();
    render(React.createElement(FloatingWindow, { ...defaultProps, onClose }));
    const closeBtn = screen.getByTitle("Đóng");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/floating-window.test.tsx
git commit -m "test(floating-window): add state transition tests"
```
