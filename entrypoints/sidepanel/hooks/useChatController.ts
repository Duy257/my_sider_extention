import { useEffect, useRef, useState } from "react";
import { useAiStream } from "../../../src/hooks/useAiStream";
import { buildUserChatMessages } from "../../../src/core/prompts/builders";
import type { AiDevContext, AiDevTrace, ToolDevTrace } from "../../../src/core/devtools/types";
import { appendReasoning, applyDebugUpdate } from "../../../src/core/devtools/trace-reducer";
import { CHAT_SETTINGS } from "../../../src/constants";

export type ChatMessageItem = {
  kind: "message";
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  debug?: AiDevTrace;
};

export type ChatTimelineItem =
  | ChatMessageItem
  | { kind: "tool-trace"; id: string; trace: ToolDevTrace };

export type StreamingPhase = "idle" | "connecting" | "streaming";

export type UseChatControllerOptions = {
  canSend: boolean;
  autoDismissErrorMs?: number;
};

export type UseChatControllerResult = {
  messages: ChatTimelineItem[];
  streaming: boolean;
  streamingPhase: StreamingPhase;
  error: string;
  sendPrompt: (
    text: string,
    thinkingMode?: "off" | "low" | "medium" | "high" | "max",
    devContext?: AiDevContext
  ) => void;
  cancelStream: () => void;
  clearChat: () => void;
  dismissError: () => void;
  setError: (message: string) => void;
  setMessages: (next: ChatTimelineItem[] | ((current: ChatTimelineItem[]) => ChatTimelineItem[])) => void;
};

export function useChatController({ canSend, autoDismissErrorMs = CHAT_SETTINGS.ERROR_DISMISS_MS }: UseChatControllerOptions): UseChatControllerResult {
  const [messages, setMessagesState] = useState<ChatTimelineItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingPhase, setStreamingPhase] = useState<StreamingPhase>("idle");
  const [error, setErrorState] = useState("");
  const messagesRef = useRef<ChatTimelineItem[]>([]);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingRef = useRef(false);

  // Throttling stream buffers
  const activeAssistantIdRef = useRef<string | null>(null);
  const contentBufferRef = useRef("");
  const reasoningBufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setMessages(next: ChatTimelineItem[] | ((current: ChatTimelineItem[]) => ChatTimelineItem[])) {
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
  }

  const startFlushTimer = (id: string) => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setInterval(() => {
      const contentDelta = contentBufferRef.current;
      const reasoningDelta = reasoningBufferRef.current;

      if (!contentDelta && !reasoningDelta) return;

      contentBufferRef.current = "";
      reasoningBufferRef.current = "";

      setMessages((current) =>
        current.map((item) => {
          if (item.id === id && item.kind === "message") {
            const updated = { ...item };
            if (contentDelta) {
              updated.content += contentDelta;
            }
            if (reasoningDelta && updated.debug) {
              updated.debug = appendReasoning(updated.debug, reasoningDelta);
            }
            return updated;
          }
          return item;
        })
      );
    }, CHAT_SETTINGS.STREAM_FLUSH_MS);
  };

  const stopFlushTimerAndFlush = (id: string | null, finalTrace?: AiDevTrace) => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    const contentDelta = contentBufferRef.current;
    const reasoningDelta = reasoningBufferRef.current;

    contentBufferRef.current = "";
    reasoningBufferRef.current = "";
    activeAssistantIdRef.current = null;

    if (!id) return;

    setMessages((current) =>
      current.map((item) => {
        if (item.id === id && item.kind === "message") {
          const updated = { ...item };
          if (contentDelta) {
            updated.content += contentDelta;
          }
          if (finalTrace) {
            updated.debug = finalTrace;
          } else if (reasoningDelta && updated.debug) {
            updated.debug = appendReasoning(updated.debug, reasoningDelta);
          }
          return updated;
        }
        return item;
      })
    );
  };

  // Định tuyến stream events qua hook dùng chung; controller chỉ lo buffer & state hiển thị
  const { start: startAiStream, stop: stopAiStream } = useAiStream({
    onConnecting: () => setStreamingPhase("connecting"),
    onFirstToken: () => setStreamingPhase("streaming"),
    onChunk: (delta) => {
      setStreamingPhase("streaming");
      contentBufferRef.current += delta;
      const id = activeAssistantIdRef.current;
      if (id) startFlushTimer(id);
    },
    onReasoning: (delta) => {
      reasoningBufferRef.current += delta;
      const id = activeAssistantIdRef.current;
      if (id) startFlushTimer(id);
    },
    onDebugStart: (trace) => {
      setMessages((current) =>
        current.map((item) =>
          item.id === activeAssistantIdRef.current && item.kind === "message" ? { ...item, debug: trace } : item
        )
      );
    },
    onDebugUpdate: ({ usage, finishReason }) => {
      setMessages((current) =>
        current.map((item) => {
          if (item.id === activeAssistantIdRef.current && item.kind === "message" && item.debug) {
            return {
              ...item,
              debug: applyDebugUpdate(item.debug, { usage, finishReason })
            };
          }
          return item;
        })
      );
    },
    onDone: (finalTrace) => {
      stopFlushTimerAndFlush(activeAssistantIdRef.current, finalTrace);
      resetStreamState();
    },
    onError: (message) => {
      stopFlushTimerAndFlush(activeAssistantIdRef.current);
      resetStreamState();
      setError(message);
    },
    onDisconnect: () => {
      stopFlushTimerAndFlush(activeAssistantIdRef.current);
      resetStreamState();
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message || "Mất kết nối.");
      }
    }
  });

  function cancelStream() {
    stopAiStream();
    stopFlushTimerAndFlush(activeAssistantIdRef.current);
    resetStreamState();
  }

  function clearChat() {
    cancelStream();
    setError("");
    setMessages([]);
  }

  function sendPrompt(
    text: string,
    thinkingMode?: "off" | "low" | "medium" | "high" | "max",
    devContext?: AiDevContext
  ) {
    const trimmed = text.trim();
    if (!trimmed || !canSend || streamingRef.current) return;

    setError("");
    streamingRef.current = true;
    setStreaming(true);
    setStreamingPhase("connecting");

    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    activeAssistantIdRef.current = assistantId;
    contentBufferRef.current = "";
    reasoningBufferRef.current = "";

    const chatMessages = messagesRef.current.filter((m): m is ChatMessageItem => m.kind === "message");
    const providerMessages = buildUserChatMessages(
      trimmed,
      chatMessages.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    );

    setMessages((current) => [
      ...current,
      { kind: "message", id: crypto.randomUUID(), role: "user", content: trimmed },
      { kind: "message", id: assistantId, role: "assistant", content: "" }
    ]);

    startAiStream({
      requestId,
      messages: providerMessages,
      ...(thinkingMode ? { thinkingMode } : {}),
      ...(devContext ? { devContext } : {})
    });
  }

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
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
    setError,
    setMessages
  };
}
