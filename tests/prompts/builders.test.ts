import { describe, expect, it } from "vitest";
import {
  buildPagePrompt,
  buildSelectionPrompt,
  buildUserChatMessages
} from "../../src/lib/prompts/builders";

describe("prompt builders", () => {
  it("builds a page prompt with truncation warning", () => {
    const prompt = buildPagePrompt({
      title: "Quarterly Ops Review",
      url: "https://example.com/report",
      text: "Revenue rose.",
      warnings: ["Page content was truncated to 40,000 characters."]
    });

    expect(prompt).toContain("Quarterly Ops Review");
    expect(prompt).toContain("https://example.com/report");
    expect(prompt).toContain("Revenue rose.");
    expect(prompt).toContain("partial page content");
  });

  it("builds a Vietnamese translation selection prompt", () => {
    const prompt = buildSelectionPrompt("translate_vi", "Hello team");

    expect(prompt).toContain("Translate");
    expect(prompt).toContain("Vietnamese");
    expect(prompt).toContain("Hello team");
  });

  it("builds chat messages with a stable system instruction", () => {
    const messages = buildUserChatMessages("Explain this");

    expect(messages[0].role).toBe("system");
    expect(messages[1]).toEqual({ role: "user", content: "Explain this" });
  });
});
