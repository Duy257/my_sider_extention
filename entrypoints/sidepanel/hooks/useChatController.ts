import { useEffect, useRef, useState } from "react";
import { AI_STREAM_PORT } from "../../../src/lib/messaging/ports";
import type { AiPortResponse } from "../../../src/lib/messaging/types";
import { buildUserChatMessages } from "../../../src/lib/prompts/builders";
import type { AiDevContext, AiDevTrace, ToolDevTrace } from "../../../src/lib/devtools/types";
import { appendReasoning, applyDebugUpdate } from "../../../src/lib/devtools/trace-reducer";

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

export function useChatController({ canSend, autoDismissErrorMs = 8000 }: UseChatControllerOptions): UseChatControllerResult {
  const [messages, setMessagesState] = useState<ChatTimelineItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingPhase, setStreamingPhase] = useState<StreamingPhase>("idle");
  const [error, setErrorState] = useState("");
  const messagesRef = useRef<ChatTimelineItem[]>([]);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingRef = useRef(false);

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

      if (message.type === "AI_STREAM_DEBUG_START") {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId && item.kind === "message" ? { ...item, debug: message.trace } : item
          )
        );
      }

      if (message.type === "AI_STREAM_REASONING") {
        setMessages((current) =>
          current.map((item) => {
            if (item.id === assistantId && item.kind === "message" && item.debug) {
              return { ...item, debug: appendReasoning(item.debug, message.delta) };
            }
            return item;
          })
        );
      }

      if (message.type === "AI_STREAM_CHUNK") {
        setStreamingPhase("streaming");
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId && item.kind === "message" ? { ...item, content: item.content + message.delta } : item
          )
        );
      }

      if (message.type === "AI_STREAM_DEBUG_UPDATE") {
        setMessages((current) =>
          current.map((item) => {
            if (item.id === assistantId && item.kind === "message" && item.debug) {
              return {
                ...item,
                debug: applyDebugUpdate(item.debug, { usage: message.usage, finishReason: message.finishReason })
              };
            }
            return item;
          })
        );
      }

      if (message.type === "AI_STREAM_DONE") {
        resetStreamState();
        if (message.trace) {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId && item.kind === "message" ? { ...item, debug: message.trace } : item
            )
          );
        }
        port.disconnect();
      }

      if (message.type === "AI_STREAM_ERROR") {
        resetStreamState();
        setError(message.message);
        if (message.trace) {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId && item.kind === "message" ? { ...item, debug: message.trace } : item
            )
          );
        }
        port.disconnect();
      }
    });

    port.postMessage({
      type: "AI_CHAT_REQUEST",
      requestId,
      messages: providerMessages,
      ...(thinkingMode ? { thinkingMode } : {}),
      ...(devContext ? { devContext } : {})
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
    setError,
    setMessages
  };
}
