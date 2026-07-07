# Sidebar Chat Foundation And UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the sidebar chat foundation, send in-memory conversation context, remove a dead pending-selection path, and add small UX improvements for auto-scroll, clear chat, copy, and save feedback.

**Architecture:** Keep the existing sidepanel and `AI_STREAM_PORT` protocol. Move chat state and port streaming out of `App.tsx` into `useChatController`, make prompt building history-aware, and keep conversation history in memory only for the current sidepanel lifetime. Add message actions and chat controls without introducing persisted chat sessions.

**Tech Stack:** WXT 0.20, Chrome Manifest V3, React 19, TypeScript 5, Tailwind CSS 3, Vitest, jsdom, React Testing Library.

## Global Constraints

- User-facing UI copy remains Vietnamese.
- Conversation history is in-memory only.
- Do not persist conversations in `chrome.storage.local`.
- Do not add multiple chat sessions, session switching, search, archived history, regenerate, edit-and-resend, branch conversations, or full chat export.
- Do not rework the floating-window chat UI.
- Do not add a background-side pending selection prompt store.
- Do not change provider settings, provider registry, API key storage, or background port protocol.
- Keep existing settings, prompt manager, saved results, and AI stream behavior working.
- Run `npm run compile` and `npm test -- --run` before claiming implementation is complete.

---

## File Structure

Files to modify:

- `src/lib/prompts/builders.ts`: make `buildUserChatMessages` accept capped chat history while keeping its existing single-input behavior.
- `tests/prompts/builders.test.ts`: verify history inclusion, empty assistant filtering, and 12-message cap.
- `entrypoints/sidepanel/App.tsx`: become the sidepanel shell, use `useChatController`, use `buildPagePrompt`, remove `GET_PENDING_SELECTION_PROMPT`, add clear-chat and auto-scroll wiring.
- `entrypoints/sidepanel/components/ChatMessage.tsx`: add copy and save feedback actions.
- `tests/chat-message.test.tsx`: cover copy and save feedback.
- `tests/sidepanel-app.test.tsx`: cover page prompt builder usage, removal of pending selection startup, clear chat, and save feedback integration.

Files to create:

- `entrypoints/sidepanel/hooks/useChatController.ts`: own chat messages, streaming state, port lifecycle, cancel, clear, and dismissible errors.
- `tests/use-chat-controller.test.tsx`: test chat controller behavior directly.

Files to verify but not modify unless a test exposes a real mismatch:

- `entrypoints/background.ts`: keep existing `AI_CHAT_REQUEST` and `AiPortResponse` handling.
- `src/lib/messaging/types.ts`: keep existing port request/response types.
- `src/lib/floating-window/*`: out of scope.

---

### Task 1: Make Chat Prompt Building History-Aware

**Files:**

- Modify: `src/lib/prompts/builders.ts`
- Modify: `tests/prompts/builders.test.ts`

**Interfaces:**

- Consumes: `AiMessage` from `src/lib/ai/types.ts`.
- Produces: `buildUserChatMessages(input: string, history?: ChatHistoryMessage[]): AiMessage[]` and `ChatHistoryMessage` type.

- [ ] **Step 1: Write failing prompt builder tests**

Append these tests inside the existing `describe("prompt builders", () => { ... })` block in `tests/prompts/builders.test.ts`:

```typescript
  it("includes recent chat history before the new user message", () => {
    const messages = buildUserChatMessages("Tiếp tục", [
      { role: "user", content: "Câu hỏi trước" },
      { role: "assistant", content: "Câu trả lời trước" }
    ]);

    expect(messages).toEqual([
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "Câu hỏi trước" },
      { role: "assistant", content: "Câu trả lời trước" },
      { role: "user", content: "Tiếp tục" }
    ]);
  });

  it("filters empty assistant placeholders from chat history", () => {
    const messages = buildUserChatMessages("Câu mới", [
      { role: "assistant", content: "" },
      { role: "assistant", content: "   " },
      { role: "user", content: "Câu cũ" }
    ]);

    expect(messages).toEqual([
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "Câu cũ" },
      { role: "user", content: "Câu mới" }
    ]);
  });

  it("caps chat history to the latest twelve non-empty messages", () => {
    const history = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `Tin ${index + 1}`
    }));

    const messages = buildUserChatMessages("Tin mới", history);

    expect(messages).toHaveLength(14);
    expect(messages[1]).toEqual({ role: "user", content: "Tin 3" });
    expect(messages[12]).toEqual({ role: "assistant", content: "Tin 14" });
    expect(messages[13]).toEqual({ role: "user", content: "Tin mới" });
  });
```

- [ ] **Step 2: Run prompt builder tests and verify failure**

Run:

```bash
npm test -- tests/prompts/builders.test.ts --run
```

Expected result: the new history tests fail because `buildUserChatMessages` only accepts one argument and ignores history.

- [ ] **Step 3: Implement history-aware prompt building**

In `src/lib/prompts/builders.ts`, add this type and constant below `PagePromptInput`:

```typescript
export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_CHAT_HISTORY_MESSAGES = 12;
```

Replace the existing `buildUserChatMessages` function with:

```typescript
export function buildUserChatMessages(input: string, history: ChatHistoryMessage[] = []): AiMessage[] {
  const recentHistory = history
    .filter((message) => message.content.trim())
    .slice(-MAX_CHAT_HISTORY_MESSAGES)
    .map((message) => ({ role: message.role, content: message.content }));

  return [
    { role: "system", content: SYSTEM_MESSAGE },
    ...recentHistory,
    { role: "user", content: input },
  ];
}
```

- [ ] **Step 4: Run prompt builder tests and verify pass**

Run:

```bash
npm test -- tests/prompts/builders.test.ts --run
```

Expected result: all prompt builder tests pass.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git status --short
git diff -- src/lib/prompts/builders.ts tests/prompts/builders.test.ts
git add src/lib/prompts/builders.ts tests/prompts/builders.test.ts
git commit -m "feat: include chat history in prompts"
```

Expected result: commit includes only `src/lib/prompts/builders.ts` and `tests/prompts/builders.test.ts`.

---

### Task 2: Extract Sidebar Chat Streaming Into A Controller Hook

**Files:**

- Create: `entrypoints/sidepanel/hooks/useChatController.ts`
- Create: `tests/use-chat-controller.test.tsx`

**Interfaces:**

- Consumes: `buildUserChatMessages(input, history)` from Task 1, `AI_STREAM_PORT`, and `AiPortResponse`.
- Produces: `useChatController(options: UseChatControllerOptions): UseChatControllerResult`.
- Produces: `ChatItem` and `StreamingPhase` exported from `entrypoints/sidepanel/hooks/useChatController.ts`.

- [ ] **Step 1: Write failing controller tests**

Create `tests/use-chat-controller.test.tsx` with this content:

```typescript
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatController } from "../entrypoints/sidepanel/hooks/useChatController";
import { portEntries } from "./setup";

describe("useChatController", () => {
  beforeEach(() => {
    portEntries.splice(0, portEntries.length);
    vi.clearAllMocks();
    chrome.runtime.lastError = undefined;
  });

  afterEach(() => {
    chrome.runtime.lastError = undefined;
  });

  it("sends the current prompt and streams chunks into the assistant message", () => {
    const { result } = renderHook(() => useChatController({ canSend: true }));

    act(() => result.current.sendPrompt("Xin chào"));

    const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(port.postMessage).toHaveBeenCalledWith({
      type: "AI_CHAT_REQUEST",
      requestId: expect.any(String),
      messages: [
        expect.objectContaining({ role: "system" }),
        { role: "user", content: "Xin chào" }
      ]
    });

    const requestId = port.postMessage.mock.calls[0][0].requestId;
    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_CHUNK", requestId, delta: "Chào" }));
    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_DONE", requestId }));

    expect(result.current.messages.map((message) => ({ role: message.role, content: message.content }))).toEqual([
      { role: "user", content: "Xin chào" },
      { role: "assistant", content: "Chào" }
    ]);
    expect(result.current.streaming).toBe(false);
  });

  it("includes previous completed messages in the next request", () => {
    const { result } = renderHook(() => useChatController({ canSend: true }));

    act(() => result.current.sendPrompt("Một"));
    const firstPort = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const firstRequestId = firstPort.postMessage.mock.calls[0][0].requestId;
    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_CHUNK", requestId: firstRequestId, delta: "Hai" }));
    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_DONE", requestId: firstRequestId }));

    act(() => result.current.sendPrompt("Ba"));
    const secondPort = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[1].value;

    expect(secondPort.postMessage.mock.calls[0][0].messages).toEqual([
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "Một" },
      { role: "assistant", content: "Hai" },
      { role: "user", content: "Ba" }
    ]);
  });

  it("clears chat and disconnects an active stream", () => {
    const { result } = renderHook(() => useChatController({ canSend: true }));

    act(() => result.current.sendPrompt("Đang chạy"));
    const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;

    act(() => result.current.clearChat());

    expect(port.disconnect).toHaveBeenCalledTimes(1);
    expect(result.current.messages).toEqual([]);
    expect(result.current.streaming).toBe(false);
    expect(result.current.streamingPhase).toBe("idle");
  });

  it("shows stream errors and allows dismissing them", () => {
    const { result } = renderHook(() => useChatController({ canSend: true, autoDismissErrorMs: 0 }));

    act(() => result.current.sendPrompt("Lỗi"));
    const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const requestId = port.postMessage.mock.calls[0][0].requestId;

    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_ERROR", requestId, message: "Provider lỗi" }));

    expect(result.current.error).toBe("Provider lỗi");
    expect(result.current.streaming).toBe(false);

    act(() => result.current.dismissError());

    expect(result.current.error).toBe("");
  });
});
```

- [ ] **Step 2: Run controller tests and verify failure**

Run:

```bash
npm test -- tests/use-chat-controller.test.tsx --run
```

Expected result: the test fails because `entrypoints/sidepanel/hooks/useChatController.ts` does not exist.

- [ ] **Step 3: Implement `useChatController`**

Create `entrypoints/sidepanel/hooks/useChatController.ts` with this content:

```typescript
import { useEffect, useRef, useState } from "react";
import { AI_STREAM_PORT } from "../../../src/lib/messaging/ports";
import type { AiPortResponse } from "../../../src/lib/messaging/types";
import { buildUserChatMessages } from "../../../src/lib/prompts/builders";

export type ChatItem = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export type StreamingPhase = "idle" | "connecting" | "streaming";

export type UseChatControllerOptions = {
  canSend: boolean;
  autoDismissErrorMs?: number;
};

export type UseChatControllerResult = {
  messages: ChatItem[];
  streaming: boolean;
  streamingPhase: StreamingPhase;
  error: string;
  sendPrompt: (text: string) => void;
  cancelStream: () => void;
  clearChat: () => void;
  dismissError: () => void;
  setError: (message: string) => void;
};

export function useChatController({ canSend, autoDismissErrorMs = 8000 }: UseChatControllerOptions): UseChatControllerResult {
  const [messages, setMessagesState] = useState<ChatItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingPhase, setStreamingPhase] = useState<StreamingPhase>("idle");
  const [error, setErrorState] = useState("");
  const messagesRef = useRef<ChatItem[]>([]);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingRef = useRef(false);

  function setMessages(next: ChatItem[] | ((current: ChatItem[]) => ChatItem[])) {
    setMessagesState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      messagesRef.current = resolved;
      return resolved;
    });
  }

  function setError(message: string) {
    setErrorState(message);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    if (message && autoDismissErrorMs > 0) {
      errorTimerRef.current = setTimeout(() => setErrorState(""), autoDismissErrorMs);
    }
  }

  function resetStreamState() {
    streamingRef.current = false;
    setStreaming(false);
    setStreamingPhase("idle");
    portRef.current = null;
  }

  function cancelStream() {
    try {
      portRef.current?.disconnect();
    } catch {}
    resetStreamState();
  }

  function clearChat() {
    cancelStream();
    setError("");
    setMessages([]);
  }

  function sendPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !canSend || streamingRef.current) return;

    setError("");
    streamingRef.current = true;
    setStreaming(true);
    setStreamingPhase("connecting");

    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const providerMessages = buildUserChatMessages(trimmed, messagesRef.current.filter((message) => message.role !== "system"));

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "" }
    ]);

    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: AI_STREAM_PORT });
      portRef.current = port;
    } catch {
      resetStreamState();
      setError("Không thể kết nối dịch vụ AI.");
      return;
    }

    port.onDisconnect.addListener(() => {
      resetStreamState();
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message || "Mất kết nối.");
      }
    });

    port.onMessage.addListener((message: AiPortResponse) => {
      if (message.requestId !== requestId) return;

      if (message.type === "AI_STREAM_CONNECTING") {
        setStreamingPhase("connecting");
      }

      if (message.type === "AI_STREAM_FIRST_TOKEN") {
        setStreamingPhase("streaming");
      }

      if (message.type === "AI_STREAM_CHUNK") {
        setStreamingPhase("streaming");
        setMessages((current) =>
          current.map((item) => (item.id === assistantId ? { ...item, content: item.content + message.delta } : item))
        );
      }

      if (message.type === "AI_STREAM_DONE") {
        resetStreamState();
        port.disconnect();
      }

      if (message.type === "AI_STREAM_ERROR") {
        resetStreamState();
        setError(message.message);
        port.disconnect();
      }
    });

    port.postMessage({
      type: "AI_CHAT_REQUEST",
      requestId,
      messages: providerMessages
    });
  }

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      try {
        portRef.current?.disconnect();
      } catch {}
    };
  }, []);

  return {
    messages,
    streaming,
    streamingPhase,
    error,
    sendPrompt,
    cancelStream,
    clearChat,
    dismissError: () => setError(""),
    setError
  };
}
```

- [ ] **Step 4: Run controller tests and verify pass**

Run:

```bash
npm test -- tests/use-chat-controller.test.tsx --run
```

Expected result: all `useChatController` tests pass.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git status --short
git diff -- entrypoints/sidepanel/hooks/useChatController.ts tests/use-chat-controller.test.tsx
git add entrypoints/sidepanel/hooks/useChatController.ts tests/use-chat-controller.test.tsx
git commit -m "feat: extract sidebar chat controller"
```

Expected result: commit includes only `entrypoints/sidepanel/hooks/useChatController.ts` and `tests/use-chat-controller.test.tsx`.

---

### Task 3: Wire The Controller Into The Sidebar Shell

**Files:**

- Modify: `entrypoints/sidepanel/App.tsx`
- Modify: `tests/sidepanel-app.test.tsx`

**Interfaces:**

- Consumes: `useChatController({ canSend })` from Task 2.
- Consumes: `buildPagePrompt(input)` from `src/lib/prompts/builders.ts`.
- Produces: `App.tsx` without inline port streaming, without `GET_PENDING_SELECTION_PROMPT`, with clear-chat and auto-scroll behavior.

- [ ] **Step 1: Replace the app test file with coverage for shell behavior**

Replace `tests/sidepanel-app.test.tsx` with this content:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import App from "../entrypoints/sidepanel/App";
import { portEntries } from "./setup";

beforeEach(() => {
  vi.clearAllMocks();
  portEntries.splice(0, portEntries.length);
  chrome.runtime.lastError = undefined;
});

test("renders the sidebar after settings load", async () => {
  render(<App />);

  expect(await screen.findByText(/Thêm khóa API cho OpenAI/)).toBeInTheDocument();
});

test("does not request a pending selection prompt on startup", async () => {
  render(<App />);

  await screen.findByText(/Thêm khóa API cho OpenAI/);

  expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "GET_PENDING_SELECTION_PROMPT" }));
});

test("read page uses the shared page prompt path", async () => {
  const user = userEvent.setup();
  vi.mocked(chrome.runtime.sendMessage).mockImplementation((message) => {
    if (message?.type === "EXTRACT_ACTIVE_PAGE") {
      return Promise.resolve({
        title: "Báo cáo",
        url: "https://example.com/report",
        text: "Nội dung quan trọng",
        warnings: ["Nội dung trang bị cắt bớt còn 40,000 ký tự."]
      });
    }
    return Promise.resolve(null);
  });

  render(<App />);
  await screen.findByText(/Thêm khóa API cho OpenAI/);

  await user.click(screen.getByTitle("Cài đặt"));
  await user.type(screen.getByLabelText("OpenAI API key"), "sk-test");
  await user.click(screen.getByTitle("Đọc trang"));

  await waitFor(() => expect(chrome.runtime.connect).toHaveBeenCalled());
  const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
  const payload = port.postMessage.mock.calls[0][0];

  expect(payload.messages.at(-1).content).toContain("Đọc trang này và tóm tắt từ góc nhìn CEO.");
  expect(payload.messages.at(-1).content).toContain("Tiêu đề: Báo cáo");
  expect(payload.messages.at(-1).content).toContain("URL: https://example.com/report");
  expect(payload.messages.at(-1).content).toContain("Nội dung trang:");
});

test("chat mới clears messages and cancels an active stream", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText(/Thêm khóa API cho OpenAI/);

  await user.click(screen.getByTitle("Cài đặt"));
  await user.type(screen.getByLabelText("OpenAI API key"), "sk-test");
  await user.click(screen.getByText("AI Cá Nhân"));
  await user.type(screen.getByPlaceholderText("Hỏi về công việc của bạn..."), "Xin chào");
  await user.click(screen.getByTitle("Gửi"));

  const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
  expect(await screen.findByText("Xin chào")).toBeInTheDocument();

  await user.click(screen.getByTitle("Chat mới"));

  expect(port.disconnect).toHaveBeenCalled();
  expect(screen.queryByText("Xin chào")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run app tests and verify failure**

Run:

```bash
npm test -- tests/sidepanel-app.test.tsx --run
```

Expected result: tests fail because `App.tsx` still owns inline streaming, calls `GET_PENDING_SELECTION_PROMPT`, builds read-page prompts inline, and has no `Chat mới` control.

- [ ] **Step 3: Update `App.tsx` imports**

In `entrypoints/sidepanel/App.tsx`, replace the current imports with:

```typescript
import { useEffect, useMemo, useRef, useState } from "react";
import { getProvider } from "../../src/lib/ai/providers";
import { buildPagePrompt } from "../../src/lib/prompts/builders";
import { getPromptTemplates, getSavedResults, getSettings, savePromptTemplates, saveSavedResults, saveSettings } from "../../src/lib/storage";
import type { PromptTemplate } from "../../src/lib/prompts/types";
import type { SavedResult, Settings } from "../../src/lib/storage/types";
import { ChatComposer } from "./components/ChatComposer";
import { ChatMessage, TypingIndicator } from "./components/ChatMessage";
import { HeaderBar, type HeaderView } from "./components/HeaderBar";
import { PromptManager } from "./components/PromptManager";
import { SavedResults } from "./components/SavedResults";
import { SettingsPanel } from "./components/SettingsPanel";
import { SkeletonPanel } from "./components/Skeleton";
import { EmptyState } from "./components/EmptyState";
import { useChatController, type ChatItem } from "./hooks/useChatController";
```

- [ ] **Step 4: Replace inline chat state with the controller**

In `App.tsx`, delete the local `ChatItem` and `StreamingPhase` type definitions, delete `messages`, `streaming`, `streamingPhase`, `portRef`, `error`, `setError`, and `errorTimerRef` state declarations, and add this after `const [readingPage, setReadingPage] = useState(false);`:

```typescript
  const chatEndRef = useRef<HTMLDivElement>(null);
```

After `missingModel` is computed, add:

```typescript
  const chat = useChatController({ canSend: Boolean(settings && provider && !missingApiKey && !missingModel) });
```

- [ ] **Step 5: Simplify mount cleanup and remove pending selection recovery**

In the first `useEffect`, replace the whole effect with:

```typescript
  useEffect(() => {
    Promise.all([getSettings(), getPromptTemplates(), getSavedResults()]).then(([loadedSettings, loadedPrompts, loadedSaved]) => {
      setSettings(loadedSettings);
      setPrompts(loadedPrompts);
      setSavedResultsState(loadedSaved);
    });
    chrome.runtime.sendMessage({ type: "ACTIVATE_ACTIVE_TAB_AGENT", requestId: crypto.randomUUID() }).catch(() => undefined);
  }, []);
```

Delete the entire `useEffect` block that sends `{ type: "GET_PENDING_SELECTION_PROMPT" }`.

- [ ] **Step 6: Route selection messages and auto-scroll through the controller**

Replace `const sendPromptRef = useRef(sendPrompt);` with:

```typescript
  const sendPromptRef = useRef(chat.sendPrompt);
```

Replace `sendPromptRef.current = sendPrompt;` with:

```typescript
  sendPromptRef.current = chat.sendPrompt;
```

Add this effect below the selection message listener effect:

```typescript
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chat.messages, chat.streamingPhase]);
```

- [ ] **Step 7: Delete inline `sendPrompt` and update save/read handlers**

Delete the entire inline `sendPrompt` function.

Replace `saveMessage` with:

```typescript
  async function saveMessage(item: ChatItem) {
    const newResult: SavedResult = {
      id: crypto.randomUUID(),
      title: item.content.slice(0, 60) || "Phản hồi đã lưu",
      sourceType: "chat" as const,
      outputMarkdown: item.content,
      createdAt: new Date().toISOString()
    };
    await updateSavedResults([newResult, ...savedResults]);
  }
```

In `readPage`, replace `setError("");` with `chat.setError("");`, replace every `setError(...)` call with `chat.setError(...)`, and replace the inline prompt array passed to `sendPrompt(...)` with:

```typescript
      chat.sendPrompt(
        buildPagePrompt({
          title: response.title,
          url: response.url,
          text: response.text,
          warnings: response.warnings || []
        })
      );
```

- [ ] **Step 8: Update render references and add clear chat UI**

In the returned JSX, replace `error` with `chat.error`, `setError("")` with `chat.dismissError()`, `messages` with `chat.messages`, `streaming` with `chat.streaming`, `streamingPhase` with `chat.streamingPhase`, and `sendPrompt` with `chat.sendPrompt`.

Inside the chat fragment, before the `<section ...>` element, add:

```tsx
          {chat.messages.length > 0 || chat.streaming ? (
            <div className="flex justify-end px-3.5 pt-3">
              <button
                type="button"
                title="Chat mới"
                onClick={chat.clearChat}
                className="rounded-lg border border-stone-800/60 bg-surface/60 px-3 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:border-primary/30 hover:text-stone-100"
              >
                Chat mới
              </button>
            </div>
          ) : null}
```

Replace the inline cancel button handler with:

```tsx
                  onClick={chat.cancelStream}
```

Before the closing `</section>`, add:

```tsx
            <div ref={chatEndRef} />
```

- [ ] **Step 9: Run app tests and verify pass**

Run:

```bash
npm test -- tests/sidepanel-app.test.tsx --run
```

Expected result: all sidebar app tests pass.

- [ ] **Step 10: Run related tests and verify pass**

Run:

```bash
npm test -- tests/use-chat-controller.test.tsx tests/chat-composer.test.tsx tests/header-bar.test.tsx --run
```

Expected result: all listed tests pass.

- [ ] **Step 11: Commit Task 3**

Run:

```bash
git status --short
git diff -- entrypoints/sidepanel/App.tsx tests/sidepanel-app.test.tsx
git add entrypoints/sidepanel/App.tsx tests/sidepanel-app.test.tsx
git commit -m "feat: wire chat controller into sidebar"
```

Expected result: commit includes only `entrypoints/sidepanel/App.tsx` and `tests/sidepanel-app.test.tsx`.

---

### Task 4: Add Copy And Save Feedback To Chat Messages

**Files:**

- Modify: `entrypoints/sidepanel/components/ChatMessage.tsx`
- Modify: `tests/chat-message.test.tsx`
- Modify: `entrypoints/sidepanel/App.tsx`
- Modify: `tests/sidepanel-app.test.tsx`

**Interfaces:**

- Consumes: `ChatMessage` props `role`, `content`, and optional `onSave`.
- Produces: `ChatMessage` props `onSave?: () => void | Promise<void>` and `onActionError?: (message: string) => void`.
- Produces: copy feedback text `Đã sao chép` and save feedback text `Đã lưu`.

- [ ] **Step 1: Add failing message action tests**

Append these tests to `tests/chat-message.test.tsx`:

```typescript
import userEvent from "@testing-library/user-event";

test("copies message content and shows feedback", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn(() => Promise.resolve());
  Object.assign(navigator, { clipboard: { writeText } });

  render(<ChatMessage role="assistant" content="Nội dung cần sao chép" />);

  await user.click(screen.getByTitle("Sao chép"));

  expect(writeText).toHaveBeenCalledWith("Nội dung cần sao chép");
  expect(await screen.findByText("Đã sao chép")).toBeInTheDocument();
});

test("shows saved feedback only after save resolves", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn(() => Promise.resolve());

  render(<ChatMessage role="assistant" content="Response" onSave={onSave} />);

  await user.click(screen.getByTitle("Lưu"));

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("Đã lưu")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run chat message tests and verify failure**

Run:

```bash
npm test -- tests/chat-message.test.tsx --run
```

Expected result: tests fail because `Sao chép`, `Đã sao chép`, and `Đã lưu` behavior is not implemented.

- [ ] **Step 3: Implement message actions**

In `entrypoints/sidepanel/components/ChatMessage.tsx`, replace the first import with:

```typescript
import React, { useEffect, useRef, useState } from "react";
```

Replace the `ChatMessage` props type with:

```typescript
export function ChatMessage(props: {
  role: "user" | "assistant" | "system";
  content: string;
  onSave?: () => void | Promise<void>;
  onActionError?: (message: string) => void;
}) {
```

Immediately after `const isSystem = props.role === "system";`, add:

```typescript
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showTemporaryFeedback(type: "copied" | "saved") {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setCopied(type === "copied");
    setSaved(type === "saved");
    feedbackTimerRef.current = setTimeout(() => {
      setCopied(false);
      setSaved(false);
    }, 1800);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(props.content);
      showTemporaryFeedback("copied");
    } catch {
      props.onActionError?.("Không thể sao chép nội dung.");
    }
  }

  async function saveMessage() {
    if (!props.onSave) return;
    try {
      await props.onSave();
      showTemporaryFeedback("saved");
    } catch {
      props.onActionError?.("Không thể lưu kết quả.");
    }
  }

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);
```

Replace the existing save button block with this actions block:

```tsx
        <div className={`mt-1 flex items-center gap-1 opacity-60 transition-opacity duration-200 group-hover:opacity-100 ${isUser ? "justify-end" : "justify-start"}`}>
          <button
            className="flex items-center gap-1 rounded-md border border-stone-800/40 bg-surface/50 px-2 py-1 text-[11px] font-medium text-stone-400 transition-all duration-200 hover:border-stone-700/60 hover:bg-surface hover:text-stone-200"
            title="Sao chép"
            onClick={copyMessage}
          >
            {copied ? "Đã sao chép" : "Sao chép"}
          </button>
          {!isUser && props.onSave ? (
            <button
              className="flex items-center gap-1 rounded-md border border-stone-800/40 bg-surface/50 px-2 py-1 text-[11px] font-medium text-stone-400 transition-all duration-200 hover:border-stone-700/60 hover:bg-surface hover:text-stone-200"
              title="Lưu"
              onClick={saveMessage}
            >
              {saved ? "Đã lưu" : "Lưu kết quả"}
            </button>
          ) : null}
        </div>
```

- [ ] **Step 4: Pass chat errors into message actions from `App.tsx`**

In `entrypoints/sidepanel/App.tsx`, update each `ChatMessage` render to pass `onActionError`:

```tsx
                <ChatMessage 
                  key={item.id} 
                  role={item.role} 
                  content={item.content} 
                  onSave={item.role === "assistant" ? () => saveMessage(item) : undefined}
                  onActionError={chat.setError}
                />
```

- [ ] **Step 5: Run chat message tests and verify pass**

Run:

```bash
npm test -- tests/chat-message.test.tsx --run
```

Expected result: all chat message tests pass.

- [ ] **Step 6: Run sidebar app tests and verify pass**

Run:

```bash
npm test -- tests/sidepanel-app.test.tsx --run
```

Expected result: all sidebar app tests pass.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git status --short
git diff -- entrypoints/sidepanel/components/ChatMessage.tsx tests/chat-message.test.tsx entrypoints/sidepanel/App.tsx tests/sidepanel-app.test.tsx
git add entrypoints/sidepanel/components/ChatMessage.tsx tests/chat-message.test.tsx entrypoints/sidepanel/App.tsx tests/sidepanel-app.test.tsx
git commit -m "feat: add chat message actions"
```

Expected result: commit includes only chat message action changes and the `App.tsx` prop wiring.

---

### Task 5: Full Verification And Cleanup

**Files:**

- Verify: all modified files from Tasks 1-4.

**Interfaces:**

- Consumes: completed Task 1 through Task 4 commits.
- Produces: verified implementation with passing typecheck and tests.

- [ ] **Step 1: Run TypeScript compile**

Run:

```bash
npm run compile
```

Expected result: `tsc --noEmit` exits with status 0.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test -- --run
```

Expected result: all Vitest test files pass.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status --short
git diff
```

Expected result: only intentional source and test files are modified. There are no changes to provider settings, background port protocol, floating-window UI, storage schema, or generated output directories.

- [ ] **Step 4: Commit verification fixes if the verification commands required code changes**

Run this only when Step 1 or Step 2 required a source or test fix:

```bash
git add entrypoints/sidepanel src/lib tests
git commit -m "fix: stabilize sidebar chat improvements"
```

Expected result: commit includes only fixes required to make compile and tests pass.

- [ ] **Step 5: Report completion evidence**

Report these exact items:

```text
Implemented sidebar chat foundation and UX improvements.
Verification:
- npm run compile: passed
- npm test -- --run: passed
```
