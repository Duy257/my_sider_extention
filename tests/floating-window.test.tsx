import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FloatingWindow } from "../src/components/floating-window/FloatingWindow";
import { portEntries } from "./setup";

describe("FloatingWindow", () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    portEntries.splice(0, portEntries.length);
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  const defaultProps = {
    initialPosition: { top: 100, left: 100 },
    messages: [
      { role: "system" as const, content: "system" },
      { role: "user" as const, content: "Test prompt" },
    ],
    requestId: "test-id",
    onClose: vi.fn(),
  };

  it("renders in default state with loading indicator and dynamic loading title", () => {
    render(React.createElement(FloatingWindow, defaultProps));
    // Dynamic title when streamState is "loading"
    expect(screen.getByText("AI đang kết nối...")).toBeInTheDocument();
    // Loading dots should be present
    const container = screen.getByText("AI đang kết nối...").closest("[style]");
    expect(container).toBeDefined();
  });

  it("transitions to minimized state when minimize button clicked", () => {
    render(React.createElement(FloatingWindow, defaultProps));
    const minimizeBtn = screen.getByTitle("Thu nhỏ");
    fireEvent.click(minimizeBtn);
    // In minimized state, there should be elements with "AI" text (icon and title)
    expect(screen.getAllByText("AI").length).toBe(2);
  });

  it("closes when close button clicked", () => {
    const onClose = vi.fn();
    render(React.createElement(FloatingWindow, { ...defaultProps, onClose }));
    const closeBtn = screen.getByTitle("Đóng");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders ToolTraceCard when toolTrace is provided", async () => {
    const toolTrace = {
      requestId: "tool-req-123",
      tool: "selection-action" as const,
      status: "success" as const,
      startedAt: 1000,
      finishedAt: 1200,
      metadata: {
        action: "summarize",
        textLength: 50,
      },
    };
    render(React.createElement(FloatingWindow, { ...defaultProps, toolTrace }));

    // Allow useEffect to run and connect port
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const port = portEntries[0];
    const requestId = (chrome.runtime.connect as any).mock.results[0].value
      .postMessage.mock.calls[0][0].requestId;

    act(() => {
      port.onMessage.trigger({
        type: "AI_STREAM_CHUNK",
        requestId,
        delta: "Answer text",
      });
    });

    expect(await screen.findByText("Answer text")).toBeInTheDocument();
    expect(screen.getByText(/TOOL \/ selection-action/i)).toBeInTheDocument();
  });

  it("renders DebugDetails for AI stream trace when stream starts/done in developer mode", async () => {
    const toolTrace = {
      requestId: "tool-req-123",
      tool: "selection-action" as const,
      status: "success" as const,
      startedAt: 1000,
      finishedAt: 1200,
      metadata: {
        action: "summarize",
        textLength: 50,
      },
    };
    render(React.createElement(FloatingWindow, { ...defaultProps, toolTrace }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const port = portEntries[0];
    const requestId = (chrome.runtime.connect as any).mock.results[0].value
      .postMessage.mock.calls[0][0].requestId;

    const mockAiTrace = {
      requestId,
      surface: "floating-window" as const,
      feature: "chat" as const,
      status: "success" as const,
      providerId: "openai",
      model: "gpt-4o",
      requestedThinkingMode: "off" as const,
      effectiveRequestParams: {},
      startedAt: 1000,
      finishedAt: 1500,
      thinking: { state: "not-returned" as const, content: "" },
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
    };

    act(() => {
      port.onMessage.trigger({
        type: "AI_STREAM_DEBUG_START",
        requestId,
        trace: mockAiTrace,
      });
      port.onMessage.trigger({
        type: "AI_STREAM_CHUNK",
        requestId,
        delta: "Answer content",
      });
      port.onMessage.trigger({
        type: "AI_STREAM_DONE",
        requestId,
        trace: mockAiTrace,
      });
    });

    expect(await screen.findByText("Answer content")).toBeInTheDocument();
    expect(screen.getByText(/DEV/)).toBeInTheDocument();
    expect(screen.getByText(/15 tok/i)).toBeInTheDocument();
  });

  // Bug [F9]: Test minimize and restore (verify restore uses previous pos)
  it("minimizes and restores using previous dragged position", async () => {
    const { container } = render(React.createElement(FloatingWindow, defaultProps));
    const windowEl = container.firstElementChild as HTMLElement;

    // Header to drag
    const header = screen.getByText("AI đang kết nối...").closest("div[style*='cursor']") as HTMLElement;

    // Drag to new position (top: 200, left: 250)
    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 250, clientY: 200 });
    fireEvent.mouseUp(document);

    expect(windowEl.style.top).toBe("200px");
    expect(windowEl.style.left).toBe("250px");

    // Minimize window
    const minimizeBtn = screen.getByTitle("Thu nhỏ");
    fireEvent.click(minimizeBtn);
    expect(windowEl.style.width).toBe("180px");

    // Restore window
    const restoreBtn = screen.getByTitle("Thu nhỏ");
    fireEvent.click(restoreBtn);

    // Verify restore uses previous dragged position, not initialPosition
    expect(windowEl.style.top).toBe("200px");
    expect(windowEl.style.left).toBe("250px");
    expect(windowEl.style.width).toBe("380px");
  });

  // Bug [F9]: Test maximize and restore (verify restore uses previous size and pos)
  it("maximizes and restores using previous size and position", async () => {
    const { container } = render(
      React.createElement(FloatingWindow, {
        ...defaultProps,
        initialPosition: { top: 80, left: 120 },
      }),
    );
    const windowEl = container.firstElementChild as HTMLElement;

    // Drag to (150, 200)
    const header = screen.getByText("AI đang kết nối...").closest("div[style*='cursor']") as HTMLElement;
    fireEvent.mouseDown(header, { clientX: 120, clientY: 80 });
    fireEvent.mouseMove(document, { clientX: 200, clientY: 150 });
    fireEvent.mouseUp(document);

    expect(windowEl.style.top).toBe("150px");
    expect(windowEl.style.left).toBe("200px");

    // Resize to width: 480, height: 580
    const resizeHandle = screen.getByTestId("resize-handle");
    fireEvent.mouseDown(resizeHandle, { clientX: 380, clientY: 500 });
    fireEvent.mouseMove(document, { clientX: 480, clientY: 580 });
    fireEvent.mouseUp(document);

    expect(windowEl.style.width).toBe("480px");
    expect(windowEl.style.height).toBe("580px");

    // Maximize window
    const maximizeBtn = screen.getByTitle("Phóng to");
    fireEvent.click(maximizeBtn);

    // Should be maximized
    expect(windowEl.style.width).not.toBe("480px");

    // Restore from maximized
    const restoreBtn = screen.getByText("⤡");
    fireEvent.click(restoreBtn);

    // Verify restored size and pos
    expect(windowEl.style.top).toBe("150px");
    expect(windowEl.style.left).toBe("200px");
    expect(windowEl.style.width).toBe("480px");
    expect(windowEl.style.height).toBe("580px");

    // Test restoring via Escape key
    const maximizeBtnAgain = screen.getByTitle("Phóng to");
    fireEvent.click(maximizeBtnAgain);
    expect(windowEl.style.width).not.toBe("480px");

    fireEvent.keyDown(windowEl, { key: "Escape" });
    expect(windowEl.style.top).toBe("150px");
    expect(windowEl.style.left).toBe("200px");
    expect(windowEl.style.width).toBe("480px");
    expect(windowEl.style.height).toBe("580px");
  });

  // Bug [F2]: Maximize handling for small viewports (width <= 480)
  it("maximizes to 100% full-screen on small viewports (width <= 480)", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 400,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 600,
    });

    const { container } = render(React.createElement(FloatingWindow, defaultProps));
    const windowEl = container.firstElementChild as HTMLElement;

    const maximizeBtn = screen.getByTitle("Phóng to");
    fireEvent.click(maximizeBtn);

    expect(windowEl.style.width).toBe("100%");
    expect(windowEl.style.height).toBe("100%");
    expect(windowEl.style.top).toBe("0px");
    expect(windowEl.style.left).toBe("0px");
    expect(windowEl.style.borderRadius).toBe("0px");
  });

  // Bug [F8]: Fallback UI when responseContent is empty and streamState === "done"
  it("displays fallback message when responseContent is empty and stream is done", async () => {
    render(React.createElement(FloatingWindow, defaultProps));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const port = portEntries[0];
    const requestId = (chrome.runtime.connect as any).mock.results[0].value
      .postMessage.mock.calls[0][0].requestId;

    act(() => {
      port.onMessage.trigger({
        type: "AI_STREAM_DONE",
        requestId,
      });
    });

    expect(
      await screen.findByText("Không có phản hồi từ AI. Vui lòng thử lại."),
    ).toBeInTheDocument();
  });

  // Bug [WH2]: Header dynamic title with streamState (loading, streaming, done, error)
  it("updates header dynamic title across streamState lifecycle", async () => {
    render(React.createElement(FloatingWindow, defaultProps));

    // Initially loading
    expect(screen.getByText("AI đang kết nối...")).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const port = portEntries[0];
    const requestId = (chrome.runtime.connect as any).mock.results[0].value
      .postMessage.mock.calls[0][0].requestId;

    // Streaming chunk
    act(() => {
      port.onMessage.trigger({
        type: "AI_STREAM_CHUNK",
        requestId,
        delta: "Chunk 1",
      });
    });

    expect(screen.getByText("AI đang trả lời...")).toBeInTheDocument();

    // Stream done
    act(() => {
      port.onMessage.trigger({
        type: "AI_STREAM_DONE",
        requestId,
      });
    });

    expect(screen.getByText("AI Assistant")).toBeInTheDocument();

    // Error state test
    const { container: errorContainer } = render(
      React.createElement(FloatingWindow, { ...defaultProps, requestId: "req-err" }),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const errPort = portEntries[1];
    act(() => {
      errPort.onMessage.trigger({
        type: "AI_STREAM_ERROR",
        requestId: "req-err",
        error: "Network error",
      });
    });

    expect(errorContainer.querySelector("span")?.textContent).toBe("Lỗi phản hồi");
  });

  // Bug [F5]: Window resize reclamp
  it("re-clamps window position when browser window is resized", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 800,
    });

    const { container } = render(
      React.createElement(FloatingWindow, {
        ...defaultProps,
        initialPosition: { top: 200, left: 900 },
      }),
    );
    const windowEl = container.firstElementChild as HTMLElement;

    // Initial position
    expect(windowEl.style.left).toBe("900px");

    // Resize viewport to smaller width
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 600,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 600,
    });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Max left for width 380 in 600 viewport is 600 - 380 = 220
    expect(parseInt(windowEl.style.left, 10)).toBeLessThanOrEqual(220);
  });

  // Bug [F1]: Unmount cleanup guarantees listeners removed and body styles restored
  it("restores body styles and cleans up listeners on unmount during resize", () => {
    const { unmount } = render(React.createElement(FloatingWindow, defaultProps));

    const resizeHandle = screen.getByTestId("resize-handle");
    fireEvent.mouseDown(resizeHandle, { clientX: 380, clientY: 500 });

    expect(document.body.style.cursor).toBe("nwse-resize");
    expect(document.body.style.userSelect).toBe("none");

    // Unmount during active resize
    unmount();

    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");

    // Trigger mouse events on document post-unmount — should not throw
    expect(() => {
      fireEvent.mouseMove(document, { clientX: 400, clientY: 600 });
      fireEvent.mouseUp(document);
    }).not.toThrow();
  });

  // Bug [F6]: Stream effect does not restart when toolTrace reference changes
  it("does not restart AI stream when toolTrace reference changes", async () => {
    const { rerender } = render(
      React.createElement(FloatingWindow, {
        ...defaultProps,
        toolTrace: undefined,
      }),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);

    // Re-render with new toolTrace object
    const newToolTrace = {
      requestId: "tool-trace-id",
      tool: "selection-action" as const,
      status: "success" as const,
      startedAt: 1000,
      finishedAt: 1200,
      metadata: { action: "summarize" },
    };

    rerender(
      React.createElement(FloatingWindow, {
        ...defaultProps,
        toolTrace: newToolTrace,
      }),
    );

    // chrome.runtime.connect should still have been called only once!
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
  });

  // Bug [F7]: Uses props.sessionId when provided
  it("uses props.sessionId when provided", async () => {
    render(
      React.createElement(FloatingWindow, {
        ...defaultProps,
        sessionId: "custom-session-uuid-999",
      }),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const mockConnect = chrome.runtime.connect as any;
    const postMessageMock = mockConnect.mock.results[0].value.postMessage;
    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "custom-session-uuid-999",
      }),
    );
  });
});
