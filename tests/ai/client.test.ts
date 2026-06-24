import { describe, expect, it, vi } from "vitest";
import { streamChatCompletion } from "../../src/lib/ai/client";

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
