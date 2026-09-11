import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchModels, type ModelEntry } from "../src/core/ai/client";
import { getProvider } from "../src/core/ai/providers";

describe("openrouter provider", () => {
  it("is registered with expected definition", () => {
    const provider = getProvider("openrouter");
    expect(provider).toBeDefined();
    expect(provider?.id).toBe("openrouter");
    expect(provider?.label).toBe("OpenRouter");
    expect(provider?.baseUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(provider?.modelUrl).toBe("https://openrouter.ai/api/v1/models");
    expect(provider?.requiresApiKey).toBe(true);
    expect(provider?.defaultModel).toBe("anthropic/claude-3.5-sonnet");
  });
});

describe("fetchModels response parsing", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("maps id+name responses to { id, label: name } entries", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
            { id: "openai/gpt-5.4-mini", name: "GPT-5.4 Mini" }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await fetchModels({
      modelUrl: "https://openrouter.ai/api/v1/models",
      apiKey: "sk-test"
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.models).toEqual<ModelEntry[]>([
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
      { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" }
    ]);
  });

  it("falls back to id as label when name is missing", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: "gpt-5.4-mini" },
            { id: "gpt-5.4" }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await fetchModels({
      modelUrl: "https://api.openai.com/v1/models",
      apiKey: "sk-test"
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.models).toEqual<ModelEntry[]>([
      { id: "gpt-5.4", label: "gpt-5.4" },
      { id: "gpt-5.4-mini", label: "gpt-5.4-mini" }
    ]);
  });

  it("returns error on empty data array", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const result = await fetchModels({
      modelUrl: "https://api.openai.com/v1/models",
      apiKey: "sk-test"
    });

    expect(result).toEqual({ error: "No models returned by the provider." });
  });
});
