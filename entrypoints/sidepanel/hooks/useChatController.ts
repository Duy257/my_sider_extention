import { useEffect, useRef, useState } from "react";
import { AI_STREAM_PORT } from "../../../src/lib/messaging/ports";
import type { AiPortResponse } from "../../../src/lib/messaging/types";
import type { ChatHistoryMessage } from "../../../src/lib/prompts/builders";
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
    const providerMessages = buildUserChatMessages(trimmed, messagesRef.current.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));

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
