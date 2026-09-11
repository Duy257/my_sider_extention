import { describe, expect, it } from "vitest";
import type { ExtensionMessage, LoadModelsResponse } from "../../../src/core/messaging/types";
import type { AiDevTrace, ToolDevTrace } from "../../../src/core/devtools/types";

describe("ExtensionMessage", () => {
  it("accepts OPEN_READING_COMPANION", () => {
    const msg: ExtensionMessage = { type: "OPEN_READING_COMPANION", requestId: "abc" };
    expect(msg.type).toBe("OPEN_READING_COMPANION");
  });

  it("accepts LOAD_READER_CONTENT", () => {
    const msg: ExtensionMessage = {
      type: "LOAD_READER_CONTENT",
      requestId: "abc",
      title: "Test",
      url: "https://example.com",
      content: "<p>Hello</p>",
      excerpt: "Hello",
    };
    expect(msg.type).toBe("LOAD_READER_CONTENT");
  });

  it("accepts READER_CONTENT_READY", () => {
    const msg: ExtensionMessage = { type: "READER_CONTENT_READY", requestId: "abc" };
    expect(msg.type).toBe("READER_CONTENT_READY");
  });

  it("accepts READER_SAVE_SESSION", () => {
    const msg: ExtensionMessage = {
      type: "READER_SAVE_SESSION",
      requestId: "abc",
      title: "Test",
      url: "https://example.com",
      summary: "Test summary",
      date: "2024-01-01",
    };
    expect(msg.type).toBe("READER_SAVE_SESSION");
  });

  it("accepts LOAD_READER_ERROR", () => {
    const toolTrace: ToolDevTrace = {
      requestId: "tool-2",
      tool: "open-reader",
      status: "error",
      startedAt: 100,
      finishedAt: 150,
      metadata: {},
      error: "Timeout waiting for Reader to be ready"
    };
    const msg: ExtensionMessage = {
      type: "LOAD_READER_ERROR",
      requestId: "abc",
      error: "Handoff timeout",
      toolTrace
    };
    expect(msg.type).toBe("LOAD_READER_ERROR");
  });

  it("accepts ephemeral AI and tool dev trace contracts", () => {
    const aiTrace: AiDevTrace = {
      requestId: "request-1",
      surface: "sidepanel",
      feature: "chat",
      status: "pending",
      providerId: "openai",
      model: "gpt-5.4-mini",
      requestedThinkingMode: "high",
      effectiveRequestParams: { reasoning_effort: "high" },
      startedAt: 100,
      thinking: { state: "pending", content: "" }
    };
    const toolTrace: ToolDevTrace = {
      requestId: "tool-1",
      tool: "read-page",
      status: "success",
      startedAt: 100,
      finishedAt: 150,
      metadata: { extractor: "readability", contentChars: 420 }
    };
    expect(aiTrace.feature).toBe("chat");
    expect(toolTrace.metadata.contentChars).toBe(420);
  });
});

describe("LoadModelsResponse", () => {
  it("accepts success response with ModelEntry[]", () => {
    const res: LoadModelsResponse = {
      ok: true,
      models: [
        { id: "gpt-4o", label: "GPT-4o" },
        { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
      ],
    };
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.models).toHaveLength(2);
      expect(res.models[0].id).toBe("gpt-4o");
    }
  });

  it("accepts error response", () => {
    const res: LoadModelsResponse = {
      ok: false,
      error: "Failed to fetch models",
    };
    expect(res.ok).toBe(false);
  });
});

