// === USE AI STREAM — hook dùng chung cho mọi luồng stream AI qua Port ===
// Tập trung hóa phần logic bị lặp ở 4 nơi trước đây (useChatController, SummaryTab,
// QATab, FloatingWindow): mở port, khớp requestId, định tuyến từng loại message,
// tự ngắt kết nối khi DONE/ERROR và dọn dẹp khi unmount.
// Consumer chỉ cần khai báo callback và tự quản lý state hiển thị của mình.

import { useCallback, useEffect, useRef } from "react";
import { AI_CONNECT_ERROR } from "../constants";
import { AI_STREAM_PORT } from "../core/messaging/ports";
import type { AiPortRequest, AiPortResponse } from "../core/messaging/types";
import type { AiDevTrace, TokenUsage } from "../core/devtools/types";

export type AiStreamDebugUpdate = {
  usage?: TokenUsage;
  finishReason?: string;
};

export type AiStreamHandlers = {
  onConnecting?: () => void;
  onFirstToken?: () => void;
  onChunk?: (delta: string) => void;
  onReasoning?: (delta: string) => void;
  onDebugStart?: (trace: AiDevTrace) => void;
  onDebugUpdate?: (update: AiStreamDebugUpdate) => void;
  onDone?: (trace?: AiDevTrace) => void;
  onError?: (message: string, trace?: AiDevTrace) => void;
  onDisconnect?: () => void;
};

export type AiStreamRequest = Omit<AiPortRequest, "type">;

export function useAiStream(handlers: AiStreamHandlers) {
  // Luôn dùng handler mới nhất mà không cần re-register listener của port
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const portRef = useRef<chrome.runtime.Port | null>(null);

  const stop = useCallback(() => {
    const port = portRef.current;
    portRef.current = null;
    if (port) {
      try {
        port.disconnect();
      } catch {}
    }
  }, []);

  const start = useCallback(
    (request: AiStreamRequest) => {
      stop(); // đảm bảo chỉ có một stream đang chạy cho mỗi hook instance

      let port: chrome.runtime.Port;
      try {
        port = chrome.runtime.connect({ name: AI_STREAM_PORT });
      } catch {
        handlersRef.current.onError?.(AI_CONNECT_ERROR);
        return;
      }
      portRef.current = port;
      const { requestId } = request;

      port.onDisconnect.addListener(() => {
        if (portRef.current === port) {
          portRef.current = null;
        }
        handlersRef.current.onDisconnect?.();
      });

      port.onMessage.addListener((message: AiPortResponse) => {
        if (message.requestId !== requestId) return;
        const current = handlersRef.current;

        switch (message.type) {
          case "AI_STREAM_CONNECTING":
            current.onConnecting?.();
            break;
          case "AI_STREAM_FIRST_TOKEN":
            current.onFirstToken?.();
            break;
          case "AI_STREAM_DEBUG_START":
            current.onDebugStart?.(message.trace);
            break;
          case "AI_STREAM_REASONING":
            current.onReasoning?.(message.delta);
            break;
          case "AI_STREAM_CHUNK":
            current.onChunk?.(message.delta);
            break;
          case "AI_STREAM_DEBUG_UPDATE":
            current.onDebugUpdate?.({ usage: message.usage, finishReason: message.finishReason });
            break;
          case "AI_STREAM_DONE":
            current.onDone?.(message.trace);
            stop();
            break;
          case "AI_STREAM_ERROR":
            current.onError?.(message.message, message.trace);
            stop();
            break;
        }
      });

      port.postMessage({ type: "AI_CHAT_REQUEST", ...request });
    },
    [stop],
  );

  // Ngắt kết nối khi component unmount
  useEffect(() => {
    return () => {
      const port = portRef.current;
      portRef.current = null;
      try {
        port?.disconnect();
      } catch {}
    };
  }, []);

  return { start, stop };
}
