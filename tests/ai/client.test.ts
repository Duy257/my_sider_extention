import { describe, expect, it, vi } from "vitest";
import { fetchModels, streamChatCompletion, testConnection } from "../../src/lib/ai/client";

function createMockSSE(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
}

describe("streamChatCompletion", () => {
  it("streams delta content from Chat Completions SSE", async () => {
    const sse = [
      'data: {"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"id":"2","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n"
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createMockSSE(sse)
    });
    vi.stubGlobal("fetch", mockFetch);

    const deltas: string[] = [];
    await streamChatCompletion({
      baseUrl: "https://api.opencode.ai/v1/chat/completions",
      apiKey: "test-key",
      model: "test-model",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: {
        onDelta: (d) => deltas.push(d),
        onDone: vi.fn(),
        onError: vi.fn()
      }
    });

    expect(deltas).toEqual(["Hello", " world"]);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.opencode.ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-key"
        }),
        body: expect.stringContaining('"model":"test-model"')
      })
    );

    vi.unstubAllGlobals();
  });

  it("calls onDone after [DONE] signal", async () => {
    const sse = [
      'data: {"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n"
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      body: createMockSSE(sse)
    }));

    const onDone = vi.fn();
    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: { onDelta: vi.fn(), onDone, onError: vi.fn() }
    });

    expect(onDone).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("calls onError on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ error: { message: "Invalid API key" } }))
    }));

    const onError = vi.fn();
    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "bad-key",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: { onDelta: vi.fn(), onDone: vi.fn(), onError }
    });

    expect(onError).toHaveBeenCalledWith("Invalid API key");
    vi.unstubAllGlobals();
  });

  it("calls onError on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const onError = vi.fn();
    await streamChatCompletion({
      baseUrl: "https://invalid.url/v1/chat/completions",
      apiKey: "key",
      model: "m",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: { onDelta: vi.fn(), onDone: vi.fn(), onError }
    });

    expect(onError).toHaveBeenCalledWith("Network error. Check your internet connection.");
    vi.unstubAllGlobals();
  });
});

describe("fetchModels", () => {
  it("loads, deduplicates, and sorts model ids", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "z-model" }, { id: "a-model" }, { id: "a-model" }, { id: "" }] })
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchModels({ modelUrl: "https://api.test/v1/models", apiKey: "sk-test" })).resolves.toEqual({ models: ["a-model", "z-model"] });
    expect(mockFetch).toHaveBeenCalledWith("https://api.test/v1/models", expect.objectContaining({ headers: { Authorization: "Bearer sk-test" } }));

    vi.unstubAllGlobals();
  });

  it("omits Authorization when apiKey is empty", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "local-model" }] })
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchModels({ modelUrl: "http://localhost:1234/v1/models" });
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:1234/v1/models", expect.objectContaining({ headers: {} }));

    vi.unstubAllGlobals();
  });

  it("returns provider error messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ error: { message: "Bad key" } }))
    }));

    await expect(fetchModels({ modelUrl: "https://api.test/v1/models", apiKey: "bad" })).resolves.toEqual({ error: "Bad key" });
    vi.unstubAllGlobals();
  });

  it("returns non-json model response errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError("bad json"))
    }));

    await expect(fetchModels({ modelUrl: "https://api.test/v1/models" })).resolves.toEqual({ error: "Provider returned a non-JSON models response." });
    vi.unstubAllGlobals();
  });
});

describe("optional auth", () => {
  it("testConnection omits Authorization when apiKey is empty", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "ok" } }] })
    });
    vi.stubGlobal("fetch", mockFetch);

    await testConnection({ baseUrl: "http://localhost:1234/v1/chat/completions", model: "local-model" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:1234/v1/chat/completions",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } })
    );

    vi.unstubAllGlobals();
  });
});
