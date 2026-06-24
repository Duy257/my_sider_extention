import { mapStreamError } from "./stream";
import type { AiMessage } from "./types";

type StreamCallbacks = {
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

export async function streamChatCompletion(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: AiMessage[];
  signal?: AbortSignal;
  callbacks: StreamCallbacks;
}): Promise<void> {
  try {
    const response = await fetch(input.baseUrl, {
      method: "POST",
      signal: input.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true
      })
    });

    if (!response.ok) {
      let errorMessage = `Request failed with HTTP ${response.status}.`;
      try {
        const errorBody = await response.text();
        const parsed = JSON.parse(errorBody);
        if (parsed?.error?.message) {
          errorMessage = parsed.error.message;
        }
      } catch {}
      input.callbacks.onError(errorMessage);
      return;
    }

    if (!response.body) {
      input.callbacks.onError("No response body received from the AI provider.");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line.startsWith("data: ")) continue;
        const data = line.slice("data: ".length);

        if (data === "[DONE]") {
          try { input.callbacks.onDone(); } catch {}
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) {
            try { input.callbacks.onDelta(delta); } catch {}
          }
        } catch {}
      }
    }

    try { input.callbacks.onDone(); } catch {}
  } catch (error) {
    const mapped = mapStreamError(error);
    if (mapped) {
      try { input.callbacks.onError(mapped); } catch {}
    } else {
      try { input.callbacks.onDone(); } catch {}
    }
  }
}

export async function testConnection(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(input.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 10,
        stream: false
      })
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}.`;
      try {
        const errorBody = await response.text();
        const parsed = JSON.parse(errorBody);
        if (parsed?.error?.message) errorMessage = parsed.error.message;
      } catch {}
      return { ok: false, error: errorMessage };
    }

    const body = await response.json();
    if (!body?.choices?.[0]?.message?.content) {
      return { ok: false, error: "Provider returned an unexpected response format." };
    }

    return { ok: true };
  } catch (error) {
    const msg = error instanceof TypeError
      ? "Could not reach the provider. Check the URL."
      : error instanceof Error ? error.message : "Unknown error.";
    return { ok: false, error: msg };
  }
}

