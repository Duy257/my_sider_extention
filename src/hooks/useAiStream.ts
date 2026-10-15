// === USE AI STREAM — hook dùng chung cho mọi luồng stream AI qua Port ===
// Tập trung hóa phần logic bị lặp ở 4 nơi trước đây (useChatController, SummaryTab,
// QATab, FloatingWindow): mở port, khớp requestId, định tuyến từng loại message,
// tự ngắt kết nối khi DONE/ERROR và dọn dẹp khi unmount.
// Consumer chỉ cần khai báo callback và tự quản lý state hiển thị của mình.

import { useCallback, useEffect, useRef } from "react";
import { AI_CONNECT_ERROR } from "../constants";
import { AI_STREAM_PORT } from "../core/messaging/ports";
import type { AiFirstTokenKind, AiPortRequest, AiPortResponse } from "../core/messaging/types";
import type { AiDevTrace, TokenUsage } from "../core/devtools/types";
import {
  appendReasoning,
  applyDebugUpdate,
  endAiTrace,
  markFirstToken,
  type AiTraceEnding,
} from "../core/devtools/trace-reducer";

export type AiStreamDebugUpdate = {
  usage?: TokenUsage;
  finishReason?: string;
};

export type AiStreamFirstToken = {
  at?: number; // thời điểm background nhận token đầu (chỉ có khi dev trace bật)
  kind?: AiFirstTokenKind;
};

export type AiStreamHandlers = {
  onConnecting?: () => void;
  onFirstToken?: (info: AiStreamFirstToken) => void;
  onChunk?: (delta: string) => void;
  onReasoning?: (delta: string) => void;
  onDebugStart?: (trace: AiDevTrace) => void;
  onDebugUpdate?: (update: AiStreamDebugUpdate) => void;
  onDone?: (trace?: AiDevTrace) => void;
  onError?: (message: string, trace?: AiDevTrace) => void;
  onDisconnect?: () => void;
};

export type AiStreamOptions = {
  // Gom CHUNK/REASONING rồi gọi onChunk/onReasoning tối đa một lần mỗi flushMs (0 = gọi ngay).
  // Delta đầu tiên của mỗi đợt được đẩy ra ngay để UI phản hồi không trễ.
  flushMs?: number;
};

export type AiStreamRequest = Omit<AiPortRequest, "type">;

// Nhận hàm biến đổi trace hiện tại (undefined khi chưa có trace) và áp vào state của consumer
export type AiTraceUpdater = (
  update: (trace: AiDevTrace | undefined) => AiDevTrace | undefined,
) => void;

// Handler dùng chung để giữ một AiDevTrace khớp với stream events.
// Consumer trải các handler vào useAiStream và gọi endTrace trong onDone/onError/onDisconnect.
export function createAiTraceHandlers(updateTrace: AiTraceUpdater) {
  return {
    onFirstToken: ({ at }: AiStreamFirstToken) => {
      if (at) updateTrace((trace) => trace && markFirstToken(trace, at));
    },
    onDebugStart: (trace: AiDevTrace) => updateTrace(() => trace),
    onReasoning: (delta: string) => updateTrace((trace) => trace && appendReasoning(trace, delta)),
    onDebugUpdate: (update: AiStreamDebugUpdate) =>
      updateTrace((trace) => trace && applyDebugUpdate(trace, update)),
    endTrace: (ending: AiTraceEnding) => updateTrace((trace) => endAiTrace(trace, ending)),
  };
}

type PendingDeltas = { chunk: string; reasoning: string };

export function useAiStream(handlers: AiStreamHandlers, options: AiStreamOptions = {}) {
  const flushMs = options.flushMs ?? 0;
  // Luôn dùng handler mới nhất mà không cần re-register listener của port
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const flushMsRef = useRef(flushMs);
  flushMsRef.current = flushMs;
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const pendingRef = useRef<PendingDeltas>({ chunk: "", reasoning: "" });
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  // Đẩy phần đang gom ra handler; reasoning luôn đi trước text. Trả về true nếu có dữ liệu.
  const deliverPending = useCallback(() => {
    const { chunk, reasoning } = pendingRef.current;
    pendingRef.current = { chunk: "", reasoning: "" };
    if (reasoning) handlersRef.current.onReasoning?.(reasoning);
    if (chunk) handlersRef.current.onChunk?.(chunk);
    return Boolean(chunk || reasoning);
  }, []);

  const flush = useCallback(() => {
    clearFlushTimer();
    deliverPending();
  }, [clearFlushTimer, deliverPending]);

  const enqueue = useCallback(
    (kind: keyof PendingDeltas, delta: string) => {
      pendingRef.current[kind] += delta;
      const interval = flushMsRef.current;
      if (interval <= 0) {
        deliverPending();
        return;
      }
      if (flushTimerRef.current) return; // đang trong cửa sổ gom, chờ timer
      deliverPending();
      // Timer tự lặp lại khi còn dữ liệu, dừng khi một chu kỳ không có delta mới
      const tick = () => {
        flushTimerRef.current = deliverPending() ? setTimeout(tick, interval) : null;
      };
      flushTimerRef.current = setTimeout(tick, interval);
    },
    [deliverPending],
  );

  const disconnect = useCallback(() => {
    const port = portRef.current;
    portRef.current = null;
    if (port) {
      try {
        port.disconnect();
      } catch {}
    }
  }, []);

  // Dừng stream: đẩy nốt delta đang gom rồi mới ngắt port
  const stop = useCallback(() => {
    flush();
    disconnect();
  }, [flush, disconnect]);

  const start = useCallback(
    (request: AiStreamRequest) => {
      // Đảm bảo chỉ có một stream cho mỗi hook instance; bỏ delta sót của stream cũ
      clearFlushTimer();
      pendingRef.current = { chunk: "", reasoning: "" };
      disconnect();

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
        if (portRef.current !== port) return;
        portRef.current = null;
        flush();
        handlersRef.current.onDisconnect?.();
      });

      port.onMessage.addListener((message: AiPortResponse) => {
        if (message.requestId !== requestId) return;

        switch (message.type) {
          case "AI_STREAM_CHUNK":
            enqueue("chunk", message.delta);
            return;
          case "AI_STREAM_REASONING":
            enqueue("reasoning", message.delta);
            return;
        }

        // Mọi message khác: đẩy delta đang gom ra trước để giữ đúng thứ tự
        // (DONE/ERROR phải đến sau delta cuối cùng)
        flush();
        const current = handlersRef.current;
        switch (message.type) {
          case "AI_STREAM_CONNECTING":
            current.onConnecting?.();
            break;
          case "AI_STREAM_FIRST_TOKEN":
            current.onFirstToken?.({ at: message.at, kind: message.kind });
            break;
          case "AI_STREAM_DEBUG_START":
            current.onDebugStart?.(message.trace);
            break;
          case "AI_STREAM_DEBUG_UPDATE":
            current.onDebugUpdate?.({ usage: message.usage, finishReason: message.finishReason });
            break;
          case "AI_STREAM_DONE":
            current.onDone?.(message.trace);
            disconnect();
            break;
          case "AI_STREAM_ERROR":
            current.onError?.(message.message, message.trace);
            disconnect();
            break;
        }
      });

      port.postMessage({ type: "AI_CHAT_REQUEST", ...request });
    },
    [clearFlushTimer, disconnect, enqueue, flush],
  );

  // Ngắt kết nối khi component unmount; chỉ hủy timer, không gọi handler nữa
  useEffect(() => {
    return () => {
      clearFlushTimer();
      pendingRef.current = { chunk: "", reasoning: "" };
      disconnect();
    };
  }, [clearFlushTimer, disconnect]);

  return { start, stop };
}
