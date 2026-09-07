import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolTraceCard } from "../../src/components/devtools/ToolTraceCard";
import type { ToolDevTrace } from "../../src/core/devtools/types";
import { DEV_COPY } from "../../src/core/devtools/copy";

describe("ToolTraceCard component", () => {
  const baseTrace: ToolDevTrace = {
    requestId: "req-tool-1",
    tool: "read-page",
    status: "success",
    startedAt: 1000,
    finishedAt: 1046,
    metadata: {
      extractor: "readability",
      contentChars: 18420,
      warnings: 0,
      customKey: "customValue",
      invalidObject: { nested: "secret" } as any // should be ignored or not rendered as object
    }
  };

  it("renders status, tool name, elapsed time and safe scalar metadata fields with localized labels", () => {
    render(<ToolTraceCard trace={baseTrace} />);

    // Renders TOOL prefix and uppercase tool name
    expect(screen.getByText(new RegExp(DEV_COPY.tool))).toBeInTheDocument();
    expect(screen.getByText(/READ-PAGE/i)).toBeInTheDocument();

    // Renders elapsed time
    expect(screen.getByText(/46 ms/i)).toBeInTheDocument();

    // Expand card (since it has button for expandability)
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Renders localized labels for known keys
    expect(screen.getByText(new RegExp(DEV_COPY.metadataLabels.extractor))).toBeInTheDocument();
    expect(screen.getByText(/readability/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(DEV_COPY.metadataLabels.contentChars))).toBeInTheDocument();
    expect(screen.getByText(/18420/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(DEV_COPY.metadataLabels.warnings))).toBeInTheDocument();

    // Renders unlocalized key fallback
    expect(screen.getByText(/customKey/i)).toBeInTheDocument();
    expect(screen.getByText(/customValue/i)).toBeInTheDocument();

    // Renders status
    expect(screen.getByText(/success/i)).toBeInTheDocument();

    // Does NOT render object metadata
    expect(screen.queryByText(/invalidObject/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
  });

  it("renders pending state without elapsed ms when finishedAt is undefined", () => {
    const pendingTrace: ToolDevTrace = {
      ...baseTrace,
      finishedAt: undefined,
      status: "pending"
    };

    render(<ToolTraceCard trace={pendingTrace} />);

    // Should not render elapsed milliseconds
    expect(screen.queryByText(/ms/i)).not.toBeInTheDocument();

    // Expand to check status
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it("renders error state and error message when status is error", () => {
    const errorTrace: ToolDevTrace = {
      ...baseTrace,
      status: "error",
      error: "Trích xuất trang thất bại do lỗi mạng"
    };

    render(<ToolTraceCard trace={errorTrace} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(screen.getByText(/error/i)).toBeInTheDocument();
    expect(screen.getByText("Trích xuất trang thất bại do lỗi mạng")).toBeInTheDocument();
  });

  it("safely filters out non-scalar metadata and handles empty metadata", () => {
    const nonScalarTrace: ToolDevTrace = {
      ...baseTrace,
      metadata: {
        obj: { a: 1 } as any,
        arr: [1, 2, 3] as any,
        nullVal: null as any,
        undefVal: undefined as any,
        validNum: 42,
        validBool: true,
        validStr: "ok"
      }
    };

    render(<ToolTraceCard trace={nonScalarTrace} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(screen.queryByText(/obj/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/arr/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nullVal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/undefVal/i)).not.toBeInTheDocument();

    expect(screen.getByText(/validNum/i)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
    expect(screen.getByText(/validBool/i)).toBeInTheDocument();
    expect(screen.getByText(/true/)).toBeInTheDocument();
    expect(screen.getByText(/validStr/i)).toBeInTheDocument();
    expect(screen.getByText(/ok/)).toBeInTheDocument();
  });

  it("includes correct ARIA attributes for accessibility", () => {
    render(<ToolTraceCard trace={baseTrace} />);

    const region = screen.getByRole("region", { name: "Tool trace" });
    expect(region).toBeInTheDocument();

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", `tool-trace-${baseTrace.requestId}`);

    expect(document.getElementById(`tool-trace-${baseTrace.requestId}`)).not.toBeInTheDocument();

    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(`tool-trace-${baseTrace.requestId}`)).toBeInTheDocument();
  });
});
