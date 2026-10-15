import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SummaryTab } from "../../entrypoints/reader/components/SummaryTab";
import { QATab } from "../../entrypoints/reader/components/QATab";
import type { AiDevTrace } from "../../src/core/devtools/types";
import { portEntries } from "../setup";

function connectedPort() {
  const port = (chrome.runtime.connect as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value;
  const request = port.postMessage.mock.calls[0][0];
  const entry = portEntries[portEntries.length - 1];
  const emit = (message: Record<string, unknown>) =>
    act(() => entry.onMessage.trigger({ requestId: request.requestId, ...message }));
  return { request, emit };
}

function pendingTrace(requestId: string, feature: AiDevTrace["feature"]): AiDevTrace {
  return {
    requestId,
    surface: "reader",
    feature,
    status: "pending",
    providerId: "openai",
    model: "gpt-4o",
    requestedThinkingMode: "off",
    effectiveRequestParams: {},
    startedAt: 1000,
    thinking: { state: "pending", content: "" }
  };
}

describe("Reader AI trace", () => {
  beforeEach(() => {
    portEntries.splice(0, portEntries.length);
    vi.clearAllMocks();
  });

  it("SummaryTab sends a reader-summary devContext and shows the trace in dev mode", () => {
    render(<SummaryTab pageContent="Nội dung" title="Bài" url="https://example.com" devMode />);
    fireEvent.click(screen.getByText("Tóm tắt toàn trang"));

    const { request, emit } = connectedPort();
    expect(request.devContext).toEqual({ surface: "reader", feature: "reader-summary" });

    const trace = pendingTrace(request.requestId, "reader-summary");
    emit({ type: "AI_STREAM_DEBUG_START", trace });
    emit({ type: "AI_STREAM_CHUNK", delta: "Tóm tắt ngắn" });
    emit({
      type: "AI_STREAM_DONE",
      trace: { ...trace, status: "success", finishedAt: 2000, usage: { totalTokens: 12 } }
    });

    expect(screen.getByText("Tóm tắt ngắn")).toBeInTheDocument();
    expect(screen.getByText(/reader-summary/)).toBeInTheDocument();
    expect(screen.getByText(/12 tok/)).toBeInTheDocument();
  });

  it("SummaryTab sends no devContext when dev mode is off", () => {
    render(<SummaryTab pageContent="Nội dung" title="Bài" url="https://example.com" />);
    fireEvent.click(screen.getByText("Tóm tắt toàn trang"));

    expect(connectedPort().request).not.toHaveProperty("devContext");
  });

  it("QATab attaches a reader-qa trace to the answer and finalizes it on disconnect", () => {
    render(<QATab pageContent="Nội dung" devMode />);
    fireEvent.click(screen.getByText("Bài viết này nói về gì?"));

    const { request, emit } = connectedPort();
    expect(request.devContext).toEqual({ surface: "reader", feature: "reader-qa" });

    emit({ type: "AI_STREAM_DEBUG_START", trace: pendingTrace(request.requestId, "reader-qa") });
    emit({ type: "AI_STREAM_CHUNK", delta: "Về AI" });
    act(() => portEntries[portEntries.length - 1].onDisconnect.trigger());

    expect(screen.getByText("Về AI")).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "AI dev trace" });
    expect(region.querySelector("[aria-live='polite']")).toHaveTextContent("interrupted");
  });
});
