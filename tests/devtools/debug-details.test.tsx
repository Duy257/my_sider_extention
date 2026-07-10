import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DebugDetails } from "../../src/lib/devtools/components/DebugDetails";
import type { AiDevTrace } from "../../src/lib/devtools/types";
import { DEV_COPY } from "../../src/lib/devtools/copy";

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

  it("opens via button with aria-expanded", () => {
    render(<DebugDetails trace={baseTrace} />);
    const button = screen.getByRole("button");
    
    // Collapsed initially (unless streaming, but here status is success)
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(DEV_COPY.request)).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(DEV_COPY.request)).toBeInTheDocument();
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
