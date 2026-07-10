import { describe, expect, it } from "vitest";
import type { ExtensionMessage } from "../../../src/lib/messaging/types";
import type { AiDevTrace, ToolDevTrace } from "../../../src/lib/devtools/types";

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

