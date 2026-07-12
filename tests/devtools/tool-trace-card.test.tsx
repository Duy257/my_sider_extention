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
      invalidObject: { nested: "secret" } as any // should be ignored or not rendered as object
    }
  };

  it("renders status, tool name, elapsed time and safe scalar metadata fields", () => {
    render(<ToolTraceCard trace={baseTrace} />);

    // Renders TOOL prefix and uppercase tool name
    expect(screen.getByText(new RegExp(DEV_COPY.tool))).toBeInTheDocument();
    expect(screen.getByText(/READ-PAGE/i)).toBeInTheDocument();

    // Renders elapsed time
    expect(screen.getByText(/46 ms/i)).toBeInTheDocument();

    // Expand card (since it has button for expandability)
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Renders status success and scalar metadata fields
    expect(screen.getByText(/extractor:/i)).toBeInTheDocument();
    expect(screen.getByText(/readability/i)).toBeInTheDocument();
    expect(screen.getByText(/contentChars:/i)).toBeInTheDocument();
    expect(screen.getByText(/18420/i)).toBeInTheDocument();

    // Renders status
    expect(screen.getByText(/success/i)).toBeInTheDocument();

    // Does NOT render object metadata
    expect(screen.queryByText(/invalidObject/i)).not.toBeInTheDocument();
  });
});
