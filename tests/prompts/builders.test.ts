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

    expect(prompt).toContain("dịch");
    expect(prompt).toContain("tiếng Việt");
    expect(prompt).toContain("Hello team");
  });

  it("builds a detailed vocabulary explanation selection prompt in Vietnamese", () => {
    const prompt = buildSelectionPrompt("explain_vocabulary", "resilient strategy");

    expect(prompt).toContain("từ vựng");
    expect(prompt).toContain("loại từ");
    expect(prompt).toContain("phát âm");
    expect(prompt).toContain("collocation");
    expect(prompt).toContain("resilient strategy");
  });

  it("builds an English grammar explanation selection prompt in Vietnamese", () => {
    const prompt = buildSelectionPrompt("explain_grammar", "She has been working remotely since 2020.");

    expect(prompt).toContain("ngữ pháp tiếng Anh");
    expect(prompt).toContain("cấu trúc");
    expect(prompt).toContain("thì");
    expect(prompt).toContain("mệnh đề");
    expect(prompt).toContain("She has been working remotely since 2020.");
  });

  it("builds chat messages with a Vietnamese system instruction", () => {
    const messages = buildUserChatMessages("Giải thích điều này");

    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("trợ lý AI cá nhân");
    expect(messages[1]).toEqual({ role: "user", content: "Giải thích điều này" });
  });

  it("includes recent chat history before the new user message", () => {
    const messages = buildUserChatMessages("Tiếp tục", [
      { role: "user", content: "Câu hỏi trước" },
      { role: "assistant", content: "Câu trả lời trước" }
    ]);

    expect(messages).toEqual([
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "Câu hỏi trước" },
      { role: "assistant", content: "Câu trả lời trước" },
      { role: "user", content: "Tiếp tục" }
    ]);
  });

  it("filters empty assistant placeholders from chat history", () => {
    const messages = buildUserChatMessages("Câu mới", [
      { role: "assistant", content: "" },
      { role: "assistant", content: "   " },
      { role: "user", content: "Câu cũ" }
    ]);

    expect(messages).toEqual([
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "Câu cũ" },
      { role: "user", content: "Câu mới" }
    ]);
  });

  it("caps chat history to the latest twelve non-empty messages", () => {
    const history = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `Tin ${index + 1}`
    }));

    const messages = buildUserChatMessages("Tin mới", history);

    expect(messages).toHaveLength(14);
    expect(messages[1]).toEqual({ role: "user", content: "Tin 3" });
    expect(messages[12]).toEqual({ role: "assistant", content: "Tin 14" });
    expect(messages[13]).toEqual({ role: "user", content: "Tin mới" });
  });
});
