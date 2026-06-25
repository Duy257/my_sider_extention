import { describe, expect, it } from "vitest";
import {
  buildPagePrompt,
  buildSelectionPrompt,
  buildUserChatMessages
} from "../../src/lib/prompts/builders";

describe("prompt builders", () => {
  it("builds a page prompt with truncation warning in Vietnamese", () => {
    const prompt = buildPagePrompt({
      title: "Báo cáo Vận hành Quý",
      url: "https://example.com/report",
      text: "Doanh thu tăng.",
      warnings: ["Nội dung trang bị cắt bớt còn 40,000 ký tự."]
    });

    expect(prompt).toContain("Báo cáo Vận hành Quý");
    expect(prompt).toContain("https://example.com/report");
    expect(prompt).toContain("Doanh thu tăng.");
    expect(prompt).toContain("góc nhìn CEO");
  });

  it("builds a Vietnamese translation selection prompt in Vietnamese", () => {
    const prompt = buildSelectionPrompt("translate_vi", "Hello team");

    expect(prompt).toContain("Dịch");
    expect(prompt).toContain("tiếng Việt");
    expect(prompt).toContain("Hello team");
  });

  it("builds chat messages with a Vietnamese system instruction", () => {
    const messages = buildUserChatMessages("Giải thích điều này");

    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("trợ lý AI cá nhân");
    expect(messages[1]).toEqual({ role: "user", content: "Giải thích điều này" });
  });
});
