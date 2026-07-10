import { describe, expect, it } from "vitest";
import { getThinkingParams, resolveProviderRuntimeConfig, getDevStreamParams } from "../../src/lib/ai/runtime";
import type { Settings } from "../../src/lib/storage/types";

function settings(overrides: Partial<Settings>): Settings {
  return {
    providerId: "openai",
    apiKeys: {},
    selectedModels: {},
    defaultLanguage: "vi",
    thinkingMode: "off",
    devMode: false,
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

  it("passes thinkingMode from settings to config", () => {
    expect(resolveProviderRuntimeConfig(settings({
      providerId: "opencode",
      apiKeys: { opencode: "sk-open" },
      selectedModels: { opencode: "gpt-4o" },
      thinkingMode: "high"
    }))).toEqual({
      ok: true,
      config: expect.objectContaining({
        providerId: "opencode",
        thinkingMode: "high"
      })
    });
  });

  it("defaults thinkingMode to off when missing", () => {
    const s = settings({ apiKeys: { opencode: "sk" }, selectedModels: { opencode: "m" }, providerId: "opencode" });
    delete (s as any).thinkingMode;
    expect(resolveProviderRuntimeConfig(s)).toEqual({
      ok: true,
      config: expect.objectContaining({ thinkingMode: "off" })
    });
  });
});

describe("getThinkingParams", () => {
  it("returns reasoning_effort for openai medium", () => {
    expect(getThinkingParams("openai", "medium")).toEqual({ reasoning_effort: "medium" });
  });

  it("returns undefined for off", () => {
    expect(getThinkingParams("openai", "off")).toBeUndefined();
  });

  it("maps max to high for openai", () => {
    expect(getThinkingParams("openai", "max")).toEqual({ reasoning_effort: "high" });
  });

  it("returns undefined for unknown provider", () => {
    expect(getThinkingParams("lmstudio", "medium")).toBeUndefined();
  });

  it("returns reasoning_effort for opencode medium", () => {
    expect(getThinkingParams("opencode", "medium")).toEqual({ reasoning_effort: "medium" });
  });

  it("returns thinking object for deepseek model", () => {
    expect(getThinkingParams("opencode", "medium", "deepseek-v4-pro")).toEqual({
      thinking: { type: "enabled" }
    });
    expect(getThinkingParams("opencode", "off", "deepseek-v4-pro")).toEqual({
      thinking: { type: "disabled" }
    });
    expect(getThinkingParams("opencode", "max", "deepseek-v4-pro")).toEqual({
      thinking: { type: "enabled" },
      reasoning_effort: "max"
    });
  });
});

describe("developer mode parameters", () => {
  it("resolves devMode setting to config", () => {
    expect(resolveProviderRuntimeConfig(settings({
      providerId: "openai",
      apiKeys: { openai: "sk" },
      selectedModels: { openai: "gpt-5.4-mini" },
      devMode: true
    }))).toEqual({ ok: true, config: expect.objectContaining({ devMode: true }) });
  });

  it("returns stream_options for openai with devMode active", () => {
    expect(getDevStreamParams("openai", true)).toEqual({
      stream_options: { include_usage: true }
    });
  });

  it("returns undefined for non-openai providers with devMode active", () => {
    expect(getDevStreamParams("opencode", true)).toBeUndefined();
  });

  it("returns undefined when devMode is disabled", () => {
    expect(getDevStreamParams("openai", false)).toBeUndefined();
  });
});

