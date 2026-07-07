import { describe, expect, it } from "vitest";
import type { ExtensionMessage } from "../../../src/lib/messaging/types";

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


});
