import { describe, expect, it } from "vitest";
import { toApiBaseUrl } from "../../src/core/ai/model";
import { PROVIDERS } from "../../src/core/ai/providers";

describe("toApiBaseUrl", () => {
  it("strips the chat completions path", () => {
    expect(toApiBaseUrl("https://api.openai.com/v1/chat/completions")).toBe("https://api.openai.com/v1");
    expect(toApiBaseUrl("http://localhost:1234/v1/chat/completions/")).toBe("http://localhost:1234/v1");
  });

  it("leaves base URLs untouched", () => {
    expect(toApiBaseUrl("https://api.openai.com/v1")).toBe("https://api.openai.com/v1");
  });

  it("round-trips every registered provider URL", () => {
    for (const provider of PROVIDERS) {
      expect(`${toApiBaseUrl(provider.baseUrl)}/chat/completions`).toBe(provider.baseUrl);
    }
  });
});
