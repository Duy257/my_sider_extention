import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DebugDetails } from "../../src/components/devtools/DebugDetails";
import type { AiDevTrace } from "../../src/core/devtools/types";
import { DEV_COPY } from "../../src/core/devtools/copy";

describe("DebugDetails component", () => {
  const baseTrace: AiDevTrace = {
    requestId: "req-1",
    surface: "sidepanel",
    feature: "chat",
    status: "success",
    providerId: "openai",
    model: "gpt-4o",
    requestedThinkingMode: "high",
    effectiveRequestParams: { reasoning_effort: "high" },
    startedAt: 1000,
    finishedAt: 2500,
    thinking: { state: "returned", content: "AI reasoning steps here" },
    usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 }
  };

  it("collapsed summary shows DEV, thinking mode, and token count", () => {
    render(<DebugDetails trace={baseTrace} />);
    
    // Check collapsed summary contains DEV, high, 300 tokens (or similar)
    expect(screen.getByText(new RegExp(DEV_COPY.summaryPrefix))).toBeInTheDocument();
    expect(screen.getByText(/high/i)).toBeInTheDocument();
    expect(screen.getByText(/300 tok/i)).toBeInTheDocument();
  });

  it("opens via button with aria-expanded and correct ARIA region attributes", () => {
    render(<DebugDetails trace={baseTrace} />);
    const region = screen.getByRole("region", { name: "AI dev trace" });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");

    const button = screen.getByRole("button");
    
    // Collapsed initially (unless streaming, but here status is success)
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", `debug-details-${baseTrace.requestId}`);
    expect(document.getElementById(`debug-details-${baseTrace.requestId}`)).not.toBeInTheDocument();
    expect(screen.queryByText(DEV_COPY.request)).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(`debug-details-${baseTrace.requestId}`)).toBeInTheDocument();
    expect(screen.getByText(DEV_COPY.request)).toBeInTheDocument();
  });

  it("renders effectiveRequestParams formatted with 2-space JSON indentation", () => {
    const traceWithComplexParams: AiDevTrace = {
      ...baseTrace,
      effectiveRequestParams: {
        reasoning_effort: "high",
        max_tokens: 4096,
        temperature: 0.7
      }
    };
    const { container } = render(<DebugDetails trace={traceWithComplexParams} />);
    fireEvent.click(screen.getByRole("button"));

    const expectedJson = JSON.stringify(traceWithComplexParams.effectiveRequestParams, null, 2);
    const preElements = container.querySelectorAll("pre");
    // Find pre element containing the formatted params
    const paramsPre = Array.from(preElements).find((pre) => pre.textContent === expectedJson);
    expect(paramsPre).toBeDefined();
    expect(paramsPre?.textContent).toBe(expectedJson);
  });

  it("reasoning becomes visible and copies reasoning text to clipboard", async () => {
    // Mock navigator.clipboard
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: mockWriteText
      }
    });

    render(<DebugDetails trace={baseTrace} />);
    const button = screen.getByRole("button");
    fireEvent.click(button); // expand

    expect(screen.getByText("AI reasoning steps here")).toBeInTheDocument();

    // Click copy button
    const copyBtn = screen.getByText(DEV_COPY.copyThinking);
    fireEvent.click(copyBtn);

    expect(mockWriteText).toHaveBeenCalledWith("AI reasoning steps here");
    expect(await screen.findByText(DEV_COPY.copied)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("cleans up copy timer on unmount and clears previous timer on consecutive copies", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: mockWriteText
      }
    });

    const { unmount } = render(<DebugDetails trace={baseTrace} />);
    fireEvent.click(screen.getByRole("button"));

    const copyBtn = screen.getByText(DEV_COPY.copyThinking);
    // First copy
    await act(async () => {
      fireEvent.click(copyBtn);
      await Promise.resolve();
    });

    // Second copy clears previous timer before setting new timer
    await act(async () => {
      fireEvent.click(copyBtn);
      await Promise.resolve();
    });
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Unmount clears active timer
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);

    clearTimeoutSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("auto-expands reasoning on initial stream start but respects user manual collapse during ongoing stream", () => {
    const streamingTrace: AiDevTrace = {
      ...baseTrace,
      status: "pending",
      thinking: { state: "returned", content: "Initial thinking token..." }
    };

    const { rerender } = render(<DebugDetails trace={streamingTrace} />);
    const toggleBtn = screen.getByRole("button", { name: new RegExp(DEV_COPY.summaryPrefix) });

    // Auto-expanded on initial streaming of reasoning
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Initial thinking token...")).toBeInTheDocument();

    // User manually closes section
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    // Next streaming delta arrives
    rerender(
      <DebugDetails
        trace={{
          ...streamingTrace,
          thinking: { state: "returned", content: "Initial thinking token... more thoughts" }
        }}
      />
    );

    // Remains collapsed - does NOT force re-open on streaming deltas
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("uses thinkingNotReturned copy when reasoning is absent", () => {
    const traceNoThinking = {
      ...baseTrace,
      thinking: { state: "not-returned" as const, content: "" }
    };
    render(<DebugDetails trace={traceNoThinking} />);
    const button = screen.getByRole("button");
    fireEvent.click(button); // expand

    expect(screen.getByText(DEV_COPY.thinkingNotReturned)).toBeInTheDocument();
  });

  it("shows unavailable usage copy when usage is absent", () => {
    const traceNoUsage = {
      ...baseTrace,
      usage: undefined
    };
    render(<DebugDetails trace={traceNoUsage} />);
    const button = screen.getByRole("button");
    fireEvent.click(button); // expand

    expect(screen.getByText(DEV_COPY.unavailableUsage)).toBeInTheDocument();
  });
});
