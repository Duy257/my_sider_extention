import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatController, type ChatMessageItem } from "../entrypoints/sidepanel/hooks/useChatController";
import type { AiDevTrace } from "../src/lib/devtools/types";
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
});
