import { useCallback, useEffect, useRef, useState } from "react";
import { createAiTraceHandlers, useAiStream } from "../../../src/hooks/useAiStream";
import { buildUserChatMessages } from "../../../src/core/prompts/builders";
import type { AiDevContext, AiDevTrace, ToolDevTrace } from "../../../src/core/devtools/types";
import type { AiTraceEnding } from "../../../src/core/devtools/trace-reducer";
import { DEV_COPY } from "../../../src/core/devtools/copy";
import { AI_DISCONNECTED_ERROR, CHAT_SETTINGS } from "../../../src/constants";

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

export type StreamingPhase = "idle" | "connecting" | "thinking" | "streaming";

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
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  // Tin assistant đang nhận stream; null khi không có stream nào chạy
  const activeAssistantIdRef = useRef<string | null>(null);

  // Ổn định reference để ChatMessage (memo) không bị vẽ lại mỗi lần flush
  const setMessages = useCallback((next: ChatTimelineItem[] | ((current: ChatTimelineItem[]) => ChatTimelineItem[])) => {
    setMessagesState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      messagesRef.current = resolved;
      return resolved;
    });
  }, []);

  const setError = useCallback((message: string) => {
    setErrorState(message);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    if (message && autoDismissErrorMs > 0) {
      errorTimerRef.current = setTimeout(() => setErrorState(""), autoDismissErrorMs);
    }
  }, [autoDismissErrorMs]);

  const dismissError = useCallback(() => setError(""), [setError]);

  // Cập nhật tin assistant đang stream; id được lấy ngay lúc gọi, không phải lúc React chạy updater
  function updateActiveMessage(update: (item: ChatMessageItem) => ChatMessageItem) {
    const id = activeAssistantIdRef.current;
    if (!id) return;
    setMessages((current) =>
      current.map((item) => (item.id === id && item.kind === "message" ? update(item) : item))
    );
  }

  const { endTrace, ...traceHandlers } = createAiTraceHandlers((update) =>
    updateActiveMessage((item) => {
      const debug = update(item.debug);
      return debug === item.debug ? item : { ...item, debug };
    })
  );

  // Kết thúc lượt stream: chốt trace (trace background gửi về, hoặc UI tự chốt) và reset trạng thái
  function finishStream(ending: AiTraceEnding) {
    endTrace(ending);
    activeAssistantIdRef.current = null;
    streamingRef.current = false;
    setStreaming(false);
    setStreamingPhase("idle");
  }

  // Định tuyến stream events qua hook dùng chung; hook gom delta theo STREAM_FLUSH_MS
  const { start: startAiStream, stop: stopAiStream } = useAiStream(
    {
      ...traceHandlers,
      onConnecting: () => setStreamingPhase("connecting"),
      onFirstToken: (info) => {
        setStreamingPhase(info.kind === "reasoning" ? "thinking" : "streaming");
        traceHandlers.onFirstToken(info);
      },
      onChunk: (delta) => {
        setStreamingPhase("streaming");
        updateActiveMessage((item) => ({ ...item, content: item.content + delta }));
      },
      onDone: (trace) => finishStream(trace ? { trace } : { status: "success", now: Date.now() }),
      onError: (message, trace) => {
        finishStream(trace ? { trace } : { error: message, status: "error", now: Date.now() });
        setError(message);
      },
      onDisconnect: () => {
        const lastError = chrome.runtime.lastError;
        finishStream({ error: lastError?.message || AI_DISCONNECTED_ERROR, status: "interrupted", now: Date.now() });
        if (lastError) {
          setError(lastError.message || AI_DISCONNECTED_ERROR);
        }
      }
    },
    { flushMs: CHAT_SETTINGS.STREAM_FLUSH_MS }
  );

  function cancelStream() {
    stopAiStream(); // đẩy nốt delta đang gom vào tin trước khi chốt trace
    finishStream({ error: DEV_COPY.cancelledByUser, status: "cancelled", now: Date.now() });
  }

  function clearChat() {
    cancelStream();
    sessionIdRef.current = crypto.randomUUID();
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
      sessionId: sessionIdRef.current,
      messages: providerMessages,
      ...(thinkingMode ? { thinkingMode } : {}),
      ...(devContext ? { devContext } : {})
    });
  }

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
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
    dismissError,
    setError,
    setMessages
  };
}
