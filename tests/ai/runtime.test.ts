import { describe, expect, it } from "vitest";
import { resolveProviderRuntimeConfig } from "../../src/lib/ai/runtime";
import type { Settings } from "../../src/lib/storage/types";

function settings(overrides: Partial<Settings>): Settings {
  return {
    providerId: "openai",
    apiKeys: {},
    selectedModels: {},
    defaultLanguage: "vi",
    updatedAt: "2026-06-25T00:00:00.000Z",
    ...overrides
  };
}

describe("resolveProviderRuntimeConfig", () => {
  it("resolves selected provider key and model", () => {
    expect(resolveProviderRuntimeConfig(settings({
      providerId: "opencode",
      apiKeys: { opencode: " sk-open " },
      selectedModels: { opencode: " gpt-4o " }
    }))).toEqual({
      ok: true,
      config: expect.objectContaining({
        providerId: "opencode",
        providerLabel: "OpenCode",
        baseUrl: "https://opencode.ai/zen/go/v1/chat/completions",
        modelUrl: "https://opencode.ai/zen/go/v1/models",
        apiKey: "sk-open",
        model: "gpt-4o",
        requiresApiKey: true
      })
    });
  });

  it("allows providers that do not require api keys", () => {
    expect(resolveProviderRuntimeConfig(settings({ providerId: "lmstudio", selectedModels: { lmstudio: "local-model" } }))).toEqual({
      ok: true,
      config: expect.objectContaining({ providerId: "lmstudio", apiKey: undefined, model: "local-model", requiresApiKey: false })
    });
  });

  it("returns missing key error for providers that require keys", () => {
    expect(resolveProviderRuntimeConfig(settings({ providerId: "openai" }))).toEqual({
      ok: false,
      error: "Add your API key for OpenAI in Settings."
    });
  });

  it("falls back to provider default model", () => {
    expect(resolveProviderRuntimeConfig(settings({ providerId: "opencode", apiKeys: { opencode: "sk" }, selectedModels: {} }))).toEqual({
      ok: true,
      config: expect.objectContaining({ model: "minimax-m3" })
    });
  });

  it("returns missing model error when no selected or default model exists", () => {
    expect(resolveProviderRuntimeConfig(settings({ providerId: "lmstudio" }))).toEqual({
      ok: false,
      error: "Select a model for LMStudio in Settings."
    });
  });

  it("returns missing provider error", () => {
    expect(resolveProviderRuntimeConfig(settings({ providerId: "missing" }))).toEqual({
      ok: false,
      error: "Selected provider is not available. Choose another provider in Settings."
    });
  });
});
