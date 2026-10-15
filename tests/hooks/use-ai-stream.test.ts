import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStream, type AiStreamHandlers } from "../../src/hooks/useAiStream";
import { portEntries } from "../setup";

const REQUEST = { requestId: "req-1", messages: [{ role: "user" as const, content: "Hi" }] };

function startStream(handlers: AiStreamHandlers, flushMs?: number) {
  const hook = renderHook(() => useAiStream(handlers, flushMs === undefined ? undefined : { flushMs }));
  act(() => hook.result.current.start(REQUEST));
  const entry = portEntries[portEntries.length - 1];
  const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value;
  const send = (message: Record<string, unknown>) =>
    act(() => entry.onMessage.trigger({ requestId: REQUEST.requestId, ...message }));
  return { hook, entry, port, send };
}

describe("useAiStream", () => {
  beforeEach(() => {
    portEntries.splice(0, portEntries.length);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delivers every delta immediately when flushMs is 0 (default)", () => {
    const onChunk = vi.fn();
    const { send } = startStream({ onChunk });

    send({ type: "AI_STREAM_CHUNK", delta: "a" });
    send({ type: "AI_STREAM_CHUNK", delta: "b" });

    expect(onChunk.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("batches deltas: the first one goes out at once, the rest at most once per flushMs", () => {
    vi.useFakeTimers();
    const onChunk = vi.fn();
    const { send } = startStream({ onChunk }, 100);

    // 400 delta trong khoảng 2 giây
    for (let i = 0; i < 400; i++) {
      send({ type: "AI_STREAM_CHUNK", delta: "x" });
      act(() => {
        vi.advanceTimersByTime(5);
      });
    }
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onChunk.mock.calls[0]).toEqual(["x"]);
    expect(onChunk.mock.calls.length).toBeLessThanOrEqual(25);
    expect(onChunk.mock.calls.map(([delta]) => delta).join("")).toBe("x".repeat(400));
  });

  it("flushes buffered deltas before DONE, reasoning before text", () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const { send, port } = startStream(
      {
        onChunk: (delta) => calls.push(`chunk:${delta}`),
        onReasoning: (delta) => calls.push(`reasoning:${delta}`),
        onDone: () => calls.push("done"),
      },
      100,
    );

    send({ type: "AI_STREAM_CHUNK", delta: "A" }); // leading edge
    send({ type: "AI_STREAM_CHUNK", delta: "B" });
    send({ type: "AI_STREAM_REASONING", delta: "R" });
    send({ type: "AI_STREAM_DONE" });

    expect(calls).toEqual(["chunk:A", "reasoning:R", "chunk:B", "done"]);
    expect(port.disconnect).toHaveBeenCalledTimes(1);
  });

  it("stop() flushes buffered deltas before disconnecting", () => {
    vi.useFakeTimers();
    const onChunk = vi.fn();
    const { send, port, hook } = startStream({ onChunk }, 100);

    send({ type: "AI_STREAM_CHUNK", delta: "A" });
    send({ type: "AI_STREAM_CHUNK", delta: "B" });
    expect(onChunk).toHaveBeenCalledTimes(1);

    act(() => hook.result.current.stop());

    expect(onChunk).toHaveBeenLastCalledWith("B");
    expect(port.disconnect).toHaveBeenCalledTimes(1);
  });

  it("passes first-token time and kind to onFirstToken", () => {
    const onFirstToken = vi.fn();
    const { send } = startStream({ onFirstToken });

    send({ type: "AI_STREAM_FIRST_TOKEN", at: 1234, kind: "reasoning" });

    expect(onFirstToken).toHaveBeenCalledWith({ at: 1234, kind: "reasoning" });
  });

  it("flushes and reports onDisconnect when the background drops the port", () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const { send, entry } = startStream(
      {
        onChunk: (delta) => calls.push(`chunk:${delta}`),
        onDisconnect: () => calls.push("disconnect"),
      },
      100,
    );

    send({ type: "AI_STREAM_CHUNK", delta: "A" });
    send({ type: "AI_STREAM_CHUNK", delta: "B" });
    act(() => entry.onDisconnect.trigger());

    expect(calls).toEqual(["chunk:A", "chunk:B", "disconnect"]);
  });

  it("ignores a disconnect from a port that was already replaced by a new stream", () => {
    const onDisconnect = vi.fn();
    const { hook, entry: firstEntry } = startStream({ onDisconnect });

    act(() => hook.result.current.start({ ...REQUEST, requestId: "req-2" }));
    act(() => firstEntry.onDisconnect.trigger());

    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it("does not call handlers after unmount", () => {
    vi.useFakeTimers();
    const onChunk = vi.fn();
    const { send, hook } = startStream({ onChunk }, 100);

    send({ type: "AI_STREAM_CHUNK", delta: "A" });
    send({ type: "AI_STREAM_CHUNK", delta: "B" });
    hook.unmount();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onChunk).toHaveBeenCalledTimes(1);
  });
});
