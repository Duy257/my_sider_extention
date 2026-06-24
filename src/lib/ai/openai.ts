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
      input.callbacks.onError(`OpenAI request failed with HTTP ${response.status}.`);
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
        if (data === "[DONE]") continue;

        const event = JSON.parse(data);
        const delta = extractResponseTextDelta(event);
        if (delta) input.callbacks.onDelta(delta);
      }
    }

    input.callbacks.onDone();
  } catch (error) {
    input.callbacks.onError(mapOpenAIError(error));
  }
}
