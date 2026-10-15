import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatController, type ChatMessageItem } from "../entrypoints/sidepanel/hooks/useChatController";
import type { AiDevTrace } from "../src/core/devtools/types";
import { portEntries } from "./setup";

describe("useChatController", () => {
  beforeEach(() => {
    portEntries.splice(0, portEntries.length);
    vi.clearAllMocks();
    (chrome.runtime as any).lastError = undefined;
  });

  afterEach(() => {
    (chrome.runtime as any).lastError = undefined;
  });

  it("sends the current prompt and streams chunks into the assistant message", () => {
    const { result } = renderHook(() => useChatController({ canSend: true }));

    act(() => result.current.sendPrompt("Xin chào"));

    const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(port.postMessage).toHaveBeenCalledWith({
      type: "AI_CHAT_REQUEST",
      requestId: expect.any(String),
      sessionId: expect.any(String),
      messages: [
        expect.objectContaining({ role: "system" }),
        { role: "user", content: "Xin chào" }
      ]
    });

    const requestId = port.postMessage.mock.calls[0][0].requestId;
    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_CHUNK", requestId, delta: "Chào" }));
    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_DONE", requestId }));

    const chatMessages = result.current.messages.filter((m): m is ChatMessageItem => m.kind === "message");
    expect(chatMessages.map((message) => ({ role: message.role, content: message.content }))).toEqual([
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

  it("handles Developer Mode debug trace stream events and attaches trace to assistant message", () => {
    const { result } = renderHook(() => useChatController({ canSend: true }));

    const devContext = { surface: "sidepanel" as const, feature: "chat" as const };
    act(() => result.current.sendPrompt("Chào", undefined, devContext));

    const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(port.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      devContext
    }));

    const requestId = port.postMessage.mock.calls[0][0].requestId;
    const initialTrace: AiDevTrace = {
      requestId,
      surface: "sidepanel",
      feature: "chat",
      status: "pending",
      providerId: "openai",
      model: "gpt-4o",
      requestedThinkingMode: "off",
      effectiveRequestParams: {},
      startedAt: 1000,
      thinking: { state: "pending", content: "" }
    };

    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_DEBUG_START", requestId, trace: initialTrace }));
    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_REASONING", requestId, delta: "Plan" }));
    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_CHUNK", requestId, delta: "Answer" }));
    
    const completedTrace: AiDevTrace = {
      ...initialTrace,
      status: "success",
      finishedAt: 2000,
      thinking: { state: "returned", content: "Plan" },
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
    };
    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_DONE", requestId, trace: completedTrace }));

    const chatMessages = result.current.messages.filter((m): m is ChatMessageItem => m.kind === "message");
    expect(chatMessages.map((m) => ({ role: m.role, content: m.content }))).toEqual([
      { role: "user", content: "Chào" },
      { role: "assistant", content: "Answer" }
    ]);
    
    // Assistant message must have the final trace attached
    const assistantMessage = chatMessages.find((m) => m.role === "assistant");
    expect(assistantMessage?.debug).toEqual(completedTrace);
  });

  it("maintains the same sessionId for consecutive prompts and regenerates it after clearChat", () => {
    const { result } = renderHook(() => useChatController({ canSend: true }));

    act(() => result.current.sendPrompt("Câu 1"));
    const firstPort = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const firstSessionId = firstPort.postMessage.mock.calls[0][0].sessionId;
    const firstRequestId = firstPort.postMessage.mock.calls[0][0].requestId;

    expect(firstSessionId).toBeDefined();

    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_CHUNK", requestId: firstRequestId, delta: "Trả lời 1" }));
    act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_DONE", requestId: firstRequestId }));

    act(() => result.current.sendPrompt("Câu 2"));
    const secondPort = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[1].value;
    const secondSessionId = secondPort.postMessage.mock.calls[0][0].sessionId;

    // Must be same sessionId across conversation
    expect(secondSessionId).toBe(firstSessionId);

    // Clear chat
    act(() => result.current.clearChat());

    // Next message after clearChat must have new sessionId
    act(() => result.current.sendPrompt("Câu mới"));
    const thirdPort = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[2].value;
    const thirdSessionId = thirdPort.postMessage.mock.calls[0][0].sessionId;

    expect(thirdSessionId).toBeDefined();
    expect(thirdSessionId).not.toBe(firstSessionId);
  });

  describe("trace finalization and streaming phases", () => {
    const devContext = { surface: "sidepanel" as const, feature: "chat" as const };

    function startDevStream(result: { current: ReturnType<typeof useChatController> }) {
      act(() => result.current.sendPrompt("Chào", undefined, devContext));
      const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value;
      const requestId: string = port.postMessage.mock.calls[0][0].requestId;
      const entry = portEntries[portEntries.length - 1];
      const trace: AiDevTrace = {
        requestId,
        surface: "sidepanel",
        feature: "chat",
        status: "pending",
        providerId: "openai",
        model: "gpt-4o",
        requestedThinkingMode: "high",
        effectiveRequestParams: {},
        startedAt: 1000,
        thinking: { state: "pending", content: "" }
      };
      act(() => entry.onMessage.trigger({ type: "AI_STREAM_DEBUG_START", requestId, trace }));
      return { port, entry, requestId, trace };
    }

    function assistantDebug(result: { current: ReturnType<typeof useChatController> }) {
      const assistant = result.current.messages.find(
        (m): m is ChatMessageItem => m.kind === "message" && m.role === "assistant"
      );
      return assistant?.debug;
    }

    it("uses the finalized trace sent with AI_STREAM_ERROR", () => {
      const { result } = renderHook(() => useChatController({ canSend: true, autoDismissErrorMs: 0 }));
      const { entry, requestId, trace } = startDevStream(result);

      act(() => entry.onMessage.trigger({ type: "AI_STREAM_REASONING", requestId, delta: "Đang nghĩ" }));
      act(() =>
        entry.onMessage.trigger({
          type: "AI_STREAM_ERROR",
          requestId,
          message: "HTTP 500",
          trace: { ...trace, status: "error", error: "HTTP 500", finishedAt: 2000, thinking: { state: "returned", content: "" } }
        })
      );

      const debug = assistantDebug(result);
      expect(debug?.status).toBe("error");
      expect(debug?.finishedAt).toBe(2000);
      // Reasoning đã nhận qua delta được giữ lại dù trace cuối không kèm nội dung
      expect(debug?.thinking.content).toBe("Đang nghĩ");
      expect(result.current.error).toBe("HTTP 500");
    });

    it("finalizes the trace locally when AI_STREAM_ERROR has no trace", () => {
      const { result } = renderHook(() => useChatController({ canSend: true, autoDismissErrorMs: 0 }));
      const { entry, requestId } = startDevStream(result);

      act(() => entry.onMessage.trigger({ type: "AI_STREAM_ERROR", requestId, message: "Provider lỗi" }));

      const debug = assistantDebug(result);
      expect(debug?.status).toBe("error");
      expect(debug?.error).toBe("Provider lỗi");
      expect(debug?.finishedAt).toEqual(expect.any(Number));
    });

    it("marks the trace cancelled and flushes buffered text when the user cancels", () => {
      const { result } = renderHook(() => useChatController({ canSend: true }));
      const { port, entry, requestId } = startDevStream(result);

      act(() => entry.onMessage.trigger({ type: "AI_STREAM_CHUNK", requestId, delta: "Một " }));
      act(() => entry.onMessage.trigger({ type: "AI_STREAM_CHUNK", requestId, delta: "hai" })); // còn trong buffer
      act(() => result.current.cancelStream());

      expect(port.disconnect).toHaveBeenCalled();
      const assistant = result.current.messages.find(
        (m): m is ChatMessageItem => m.kind === "message" && m.role === "assistant"
      );
      expect(assistant?.content).toBe("Một hai");
      expect(assistant?.debug?.status).toBe("cancelled");
      expect(assistant?.debug?.finishedAt).toEqual(expect.any(Number));
      expect(result.current.streaming).toBe(false);
    });

    it("marks the trace interrupted when the background drops the port", () => {
      const { result } = renderHook(() => useChatController({ canSend: true }));
      const { entry } = startDevStream(result);

      act(() => entry.onDisconnect.trigger());

      expect(assistantDebug(result)?.status).toBe("interrupted");
      expect(result.current.streaming).toBe(false);
      expect(result.current.streamingPhase).toBe("idle");
    });

    it("records firstTokenAt and switches to the thinking phase on a reasoning first token", () => {
      const { result } = renderHook(() => useChatController({ canSend: true }));
      const { entry, requestId } = startDevStream(result);

      act(() => entry.onMessage.trigger({ type: "AI_STREAM_FIRST_TOKEN", requestId, kind: "reasoning", at: 1400 }));
      expect(result.current.streamingPhase).toBe("thinking");
      expect(assistantDebug(result)?.firstTokenAt).toBe(1400);

      act(() => entry.onMessage.trigger({ type: "AI_STREAM_CHUNK", requestId, delta: "Trả lời" }));
      expect(result.current.streamingPhase).toBe("streaming");
    });

    it("keeps the thinking phase without dev mode (no reasoning deltas are sent)", () => {
      const { result } = renderHook(() => useChatController({ canSend: true }));
      act(() => result.current.sendPrompt("Chào"));
      const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      const requestId = port.postMessage.mock.calls[0][0].requestId;

      act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_FIRST_TOKEN", requestId, kind: "reasoning" }));
      expect(result.current.streamingPhase).toBe("thinking");

      // Text luôn đến qua AI_STREAM_CHUNK kể cả khi tắt dev mode
      act(() => portEntries[0].onMessage.trigger({ type: "AI_STREAM_CHUNK", requestId, delta: "Kết quả" }));
      expect(result.current.streamingPhase).toBe("streaming");
    });

    it("keeps setError and dismissError stable across renders", () => {
      const { result, rerender } = renderHook(() => useChatController({ canSend: true }));
      const { setError, dismissError, setMessages } = result.current;
      rerender();
      expect(result.current.setError).toBe(setError);
      expect(result.current.dismissError).toBe(dismissError);
      expect(result.current.setMessages).toBe(setMessages);
    });
  });
});
