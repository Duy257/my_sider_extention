import { describe, expect, it, vi } from "vitest";
import { fetchCompletion, fetchModels, streamChatCompletion, testConnection } from "../../src/core/ai/client";

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

function sseResponse(chunks: string[]): Response {
  return new Response(createMockSSE(chunks), {
    status: 200,
    headers: { "content-type": "text/event-stream" }
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("streamChatCompletion", () => {
  it("streams delta content from Chat Completions SSE", async () => {
    const sse = [
      'data: {"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"id":"2","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n"
    ];

    const mockFetch = vi.fn().mockResolvedValue(sseResponse(sse));
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
          "content-type": "application/json",
          authorization: "Bearer test-key"
        }),
        body: expect.stringContaining('"model":"test-model"')
      })
    );
    expect(mockFetch.mock.calls[0][1].headers).not.toHaveProperty("user-agent");

    vi.unstubAllGlobals();
  });

  it("keeps system messages in the request body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(sseResponse([
      'data: {"choices":[{"delta":{"content":"Ok"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n"
    ]));
    vi.stubGlobal("fetch", mockFetch);

    const onError = vi.fn();
    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Be brief." },
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
        { role: "user", content: "Again" }
      ],
      callbacks: { onDelta: vi.fn(), onDone: vi.fn(), onError }
    });

    expect(onError).not.toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: "system", content: "Be brief." },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Again" }
    ]);
    expect(body.stream).toBe(true);

    vi.unstubAllGlobals();
  });

  it("calls onDone after [DONE] signal", async () => {
    const sse = [
      'data: {"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n"
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(sse)));

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ error: { message: "Invalid API key" } }, 401)
    ));

    const onError = vi.fn();
    const onConnecting = vi.fn();
    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "bad-key",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: { onConnecting, onDelta: vi.fn(), onDone: vi.fn(), onError }
    });

    expect(onError).toHaveBeenCalledWith("Invalid API key");
    expect(onConnecting).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("falls back to the HTTP status when the error body has no message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("Internal error", { status: 500 })
    ));

    const onError = vi.fn();
    const onDone = vi.fn();
    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: { onDelta: vi.fn(), onDone, onError }
    });

    expect(onError).toHaveBeenCalledWith("Request failed with HTTP 500.");
    expect(onDone).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("merges extraBodyParams into request body", async () => {
    const sse = [
      'data: {"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n"
    ];

    const mockFetch = vi.fn().mockResolvedValue(sseResponse(sse));
    vi.stubGlobal("fetch", mockFetch);

    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "o3-mini",
      messages: [{ role: "user", content: "Think hard" }],
      extraBodyParams: {
        reasoning_effort: "high",
        thinking: { type: "enabled" },
        stream_options: { include_usage: true }
      },
      callbacks: { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() }
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reasoning_effort).toBe("high");
    expect(body.thinking).toEqual({ type: "enabled" });
    expect(body.stream_options).toEqual({ include_usage: true });

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

  it("handles reasoning, usage, first token and finish reason callbacks in Developer Mode", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"reasoning_content":"Plan"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Answer"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":7,"total_tokens":19}}\n\n',
      "data: [DONE]\n\n"
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(sse)));

    const deltas: string[] = [];
    const reasoningDeltas: string[] = [];
    const usages: any[] = [];
    const finishReasons: string[] = [];
    const onFirstToken = vi.fn();
    const onDone = vi.fn();

    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: {
        onDelta: (d) => deltas.push(d),
        onReasoningDelta: (r) => reasoningDeltas.push(r),
        onUsage: (u) => usages.push(u),
        onFinishReason: (f) => finishReasons.push(f),
        onFirstToken,
        onDone,
        onError: vi.fn()
      }
    });

    expect(onFirstToken).toHaveBeenCalledOnce();
    expect(deltas).toEqual(["Answer"]);
    expect(reasoningDeltas).toEqual(["Plan"]);
    expect(usages).toEqual([{ inputTokens: 12, outputTokens: 7, totalTokens: 19 }]);
    expect(finishReasons).toEqual(["stop"]);
    expect(onDone).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it("skips malformed chunks and continues content streaming", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"reasoning_content": {}, "content": "Lost"}}]}\n\n',
      "data: {not json}\n\n",
      'data: {"choices":[{"delta":{"content":"Answer"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n"
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(sse)));

    const deltas: string[] = [];
    const onError = vi.fn();
    const onDone = vi.fn();

    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: {
        onDelta: (d) => deltas.push(d),
        onDone,
        onError
      }
    });

    expect(deltas).toEqual(["Answer"]);
    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it("reads OpenRouter-style delta.reasoning", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse([
      'data: {"choices":[{"delta":{"reasoning":"Think"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Done"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n"
    ])));

    const reasoningDeltas: string[] = [];
    await streamChatCompletion({
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: "sk-test",
      model: "deepseek/deepseek-r1",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: {
        onDelta: vi.fn(),
        onReasoningDelta: (r) => reasoningDeltas.push(r),
        onDone: vi.fn(),
        onError: vi.fn()
      }
    });

    expect(reasoningDeltas).toEqual(["Think"]);
    vi.unstubAllGlobals();
  });

  it("reports a timeout when no token arrives in time", async () => {
    vi.useFakeTimers();
    // Response 200 nhưng không bao giờ gửi chunk nào
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          init.signal?.addEventListener("abort", () => controller.error(init.signal?.reason));
        }
      }), { status: 200 }))
    ));

    const onError = vi.fn();
    const promise = streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: { onDelta: vi.fn(), onDone: vi.fn(), onError }
    });

    await vi.advanceTimersByTimeAsync(30_000);
    await promise;

    expect(onError).toHaveBeenCalledWith("Provider is too slow. No response after 30 seconds.");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stays silent when the caller aborts mid-stream", async () => {
    const controller = new AbortController();
    const encoder = new TextEncoder();
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve(new Response(new ReadableStream({
        start(stream) {
          stream.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n'));
          init.signal?.addEventListener("abort", () =>
            stream.error(new DOMException("aborted", "AbortError"))
          );
        }
      }), { status: 200 }))
    ));

    const onError = vi.fn();
    const deltas: string[] = [];
    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
      signal: controller.signal,
      callbacks: {
        onDelta: (d) => {
          deltas.push(d);
          controller.abort();
        },
        onDone: vi.fn(),
        onError
      }
    });

    expect(deltas).toEqual(["Partial"]);
    expect(onError).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("fetchCompletion", () => {
  it("merges extraBodyParams into request body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", mockFetch);

    await fetchCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "o3-mini",
      messages: [{ role: "user", content: "Hi" }],
      extraBodyParams: { reasoning_effort: "high" }
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reasoning_effort).toBe("high");

    vi.unstubAllGlobals();
  });

  it("returns the completion text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "Định nghĩa" } }] })
    ));

    await expect(fetchCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Explain briefly." },
        { role: "user", content: "Define" }
      ]
    })).resolves.toEqual({ ok: true, content: "Định nghĩa" });

    vi.unstubAllGlobals();
  });

  it("returns provider error messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ error: { message: "Quota exceeded" } }, 429)
    ));

    await expect(fetchCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o",
      messages: [{ role: "user", content: "Define" }]
    })).resolves.toEqual({ ok: false, error: "Quota exceeded" });

    vi.unstubAllGlobals();
  });
});

describe("testConnection", () => {
  const input = {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    apiKey: "sk-test",
    model: "gpt-4o"
  };

  it("sends a short non-stream request", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "ok" } }] })
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(testConnection(input)).resolves.toEqual({ ok: true });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    expect(body.max_tokens).toBe(10);

    vi.unstubAllGlobals();
  });

  it("returns short plain-text error bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 })));
    await expect(testConnection(input)).resolves.toEqual({ ok: false, error: "Not Found" });
    vi.unstubAllGlobals();
  });

  it("reports non-JSON success responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html></html>", { status: 200 })));
    await expect(testConnection(input)).resolves.toEqual({
      ok: false,
      error: "Provider returned a non-JSON response. Check the URL."
    });
    vi.unstubAllGlobals();
  });

  it("reports unexpected response formats", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ foo: 1 })));
    await expect(testConnection(input)).resolves.toEqual({
      ok: false,
      error: "Provider returned an unexpected response format."
    });
    vi.unstubAllGlobals();
  });

  it("reports unreachable providers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(testConnection(input)).resolves.toEqual({
      ok: false,
      error: "Could not reach the provider. Check the URL."
    });
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

    await expect(fetchModels({ modelUrl: "https://api.test/v1/models", apiKey: "sk-test" })).resolves.toEqual({
      models: [
        { id: "a-model", label: "a-model" },
        { id: "z-model", label: "z-model" }
      ]
    });
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
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", mockFetch);

    await testConnection({ baseUrl: "http://localhost:1234/v1/chat/completions", model: "local-model" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:1234/v1/chat/completions",
      expect.objectContaining({ headers: { "content-type": "application/json" } })
    );

    vi.unstubAllGlobals();
  });
});

describe("x-opencode-session header support and safety net", () => {
  it("streamChatCompletion sends x-opencode-session when sessionId is provided", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      "data: [DONE]\n\n"
    ];
    const mockFetch = vi.fn().mockResolvedValue(sseResponse(sse));
    vi.stubGlobal("fetch", mockFetch);

    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
      sessionId: "session-xyz",
      callbacks: {
        onDelta: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn()
      }
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-opencode-session": "session-xyz"
        })
      })
    );

    vi.unstubAllGlobals();
  });

  it("streamChatCompletion automatically creates x-opencode-session when calling opencode.ai URL without sessionId", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      "data: [DONE]\n\n"
    ];
    const mockFetch = vi.fn().mockResolvedValue(sseResponse(sse));
    vi.stubGlobal("fetch", mockFetch);

    await streamChatCompletion({
      baseUrl: "https://opencode.ai/zen/go/v1/chat/completions",
      apiKey: "sk-opencode",
      model: "minimax-m3",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: {
        onDelta: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn()
      }
    });

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders["x-opencode-session"]).toBeDefined();
    expect(callHeaders["x-opencode-session"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    vi.unstubAllGlobals();
  });

  it("testConnection automatically creates x-opencode-session when calling opencode.ai URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", mockFetch);

    await testConnection({
      baseUrl: "https://opencode.ai/zen/go/v1/chat/completions",
      apiKey: "sk-opencode",
      model: "minimax-m3"
    });

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders["x-opencode-session"]).toBeDefined();
    expect(callHeaders["x-opencode-session"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    vi.unstubAllGlobals();
  });

  it("fetchCompletion sends x-opencode-session when sessionId is provided or in headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "Định nghĩa" } }] }));
    vi.stubGlobal("fetch", mockFetch);

    await fetchCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o",
      messages: [{ role: "user", content: "Define" }],
      sessionId: "session-def-123"
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-opencode-session": "session-def-123"
        })
      })
    );

    vi.unstubAllGlobals();
  });
});

