import { describe, expect, it } from "vitest";
import { getDefaultProviderId, getProvider, getProviderOptions, normalizeProviders, PROVIDERS } from "../../src/lib/ai/providers";

describe("provider registry", () => {
  it("loads bundled provider definitions", () => {
    expect(PROVIDERS.map((provider) => provider.id)).toEqual(["openai", "opencode", "commandcode", "lmstudio"]);
    expect(getDefaultProviderId()).toBe("openai");
    expect(getProvider("lmstudio")?.requiresApiKey).toBe(false);
  });

  it("returns dropdown options", () => {
    expect(getProviderOptions()).toContainEqual({ id: "openai", label: "OpenAI" });
  });

  it("uses OpenCode zen API endpoints and a bundled supported model", () => {
    expect(getProvider("opencode")).toEqual(expect.objectContaining({
      baseUrl: "https://opencode.ai/zen/go/v1/chat/completions",
      modelUrl: "https://opencode.ai/zen/go/v1/models",
      defaultModel: "minimax-m3",
      knownModels: expect.arrayContaining(["minimax-m3"])
    }));
  });

  it("normalizes optional fields and trims model lists", () => {
    const providers = normalizeProviders([
      {
        id: " local ",
        label: " Local ",
        base_url: " http://localhost:1234/v1/chat/completions ",
        model_url: " http://localhost:1234/v1/models ",
        known_models: [" model-a ", "", "model-a", "model-b"]
      }
    ]);

    expect(providers).toEqual([
      {
        id: "local",
        label: "Local",
        baseUrl: "http://localhost:1234/v1/chat/completions",
        modelUrl: "http://localhost:1234/v1/models",
        requiresApiKey: true,
        defaultModel: undefined,
        knownModels: ["model-a", "model-b"]
      }
    ]);
  });

  it("rejects missing required fields", () => {
    expect(() => normalizeProviders([{ id: "bad", label: "Bad", base_url: "https://test/v1/chat/completions" }])).toThrow("Provider bad is missing model_url.");
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      normalizeProviders([
        { id: "dup", label: "One", base_url: "https://one/v1/chat/completions", model_url: "https://one/v1/models" },
        { id: "dup", label: "Two", base_url: "https://two/v1/chat/completions", model_url: "https://two/v1/models" }
      ])
    ).toThrow("Duplicate provider id: dup");
  });
});
