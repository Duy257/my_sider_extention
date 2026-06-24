import { extractResponseTextDelta, mapOpenAIError } from "./stream";
import type { AiMessage } from "./types";

type StreamCallbacks = {
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

export async function streamOpenAIResponse(input: {
  apiKey: string;
  model: string;
  messages: AiMessage[];
  signal?: AbortSignal;
  callbacks: StreamCallbacks;
}): Promise<void> {
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: input.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        input: input.messages.map((message) => ({
          role: message.role,
          content: message.content
        })),
        stream: true
      })
    });

    if (!response.ok || !response.body) {
      let errorMessage = `OpenAI request failed with HTTP ${response.status}.`;
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

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line.startsWith("event: ")) {
          currentEvent = line.slice("event: ".length);
          continue;
        }

        if (!line.startsWith("data: ")) continue;
        const data = line.slice("data: ".length);

        if (currentEvent === "response.failed") {
          let errorMessage = "OpenAI response failed.";
          try {
            const parsed = JSON.parse(data);
            if (parsed?.error?.message) errorMessage = parsed.error.message;
          } catch {}
          try { input.callbacks.onError(errorMessage); } catch {}
          reader.cancel();
          return;
        }

        if (currentEvent === "response.output_text.delta") {
          try {
            const parsed = JSON.parse(data);
            const delta = extractResponseTextDelta(parsed);
            if (delta) {
              try { input.callbacks.onDelta(delta); } catch {}
            }
          } catch {}
        }
      }
    }

    try { input.callbacks.onDone(); } catch {}
  } catch (error) {
    const mapped = mapOpenAIError(error);
    if (mapped) {
      try { input.callbacks.onError(mapped); } catch {}
    } else {
      try { input.callbacks.onDone(); } catch {}
    }
  }
}
