import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import App from "../../entrypoints/reader/App";

describe("Reader App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially and sends READER_CONTENT_READY", () => {
    // Set search query param for requestId
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      search: "?requestId=req-123"
    };

    render(<App />);
    expect(screen.getByText("Đang tải nội dung...")).toBeInTheDocument();

    // Verify background message emitted
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "READER_CONTENT_READY",
      requestId: "req-123"
    });

    window.location = originalLocation;
  });

  it("renders content and ToolTraceCard when receiving LOAD_READER_CONTENT", async () => {
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      search: "?requestId=req-123"
    };

    render(<App />);

    // Capture the registered message listener
    const onMessageContainer = (chrome.runtime.onMessage as any);
    expect(onMessageContainer.listeners.length).toBeGreaterThan(0);
    const messageListener = onMessageContainer.listeners[0];

    const mockToolTrace = {
      requestId: "tool-req-123",
      tool: "read-page" as const,
      status: "success" as const,
      startedAt: 1000,
      finishedAt: 1200,
      metadata: {
        extractor: "readability",
        contentChars: 1500
      }
    };

    // Trigger the content load message
    act(() => {
      messageListener({
        type: "LOAD_READER_CONTENT",
        requestId: "req-123",
        title: "CEO Report",
        url: "https://example.com/ceo",
        content: "Important strategy content goes here...",
        excerpt: "Brief strategy excerpt",
        toolTrace: mockToolTrace
      });
    });

    // Content should now be visible
    expect((await screen.findAllByText("CEO Report")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Important strategy content goes here/)).toBeInTheDocument();

    // Tool trace card should be rendered on the companion body
    expect(screen.getByText(/TOOL \/ read-page/i)).toBeInTheDocument();

    window.location = originalLocation;
  });

  it("renders error state and ToolTraceCard when receiving LOAD_READER_ERROR", async () => {
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      search: "?requestId=req-123"
    };

    render(<App />);

    const onMessageContainer = (chrome.runtime.onMessage as any);
    const messageListener = onMessageContainer.listeners[0];

    const mockToolTrace = {
      requestId: "tool-req-123",
      tool: "read-page" as const,
      status: "error" as const,
      startedAt: 1000,
      finishedAt: 1050,
      error: "Extraction failed completely.",
      metadata: {}
    };

    // Trigger loading error message
    act(() => {
      messageListener({
        type: "LOAD_READER_ERROR",
        requestId: "req-123",
        error: "Failed to extract page context.",
        toolTrace: mockToolTrace
      });
    });

    // Error should be visible
    expect(await screen.findByText("Failed to extract page context.")).toBeInTheDocument();

    // Tool trace card should render in error screen
    expect(screen.getByText(/TOOL \/ read-page/i)).toBeInTheDocument();

    window.location = originalLocation;
  });
});
