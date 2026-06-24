export type AiRole = "system" | "user" | "assistant";

export type AiMessage = {
  role: AiRole;
  content: string;
};

export type AiStreamEvent =
  | { type: "response.output_text.delta"; delta: string }
  | { type: "response.completed" }
  | { type: "response.failed"; error?: { message?: string } }
  | { type: string; [key: string]: unknown };

export type AiStreamChunk =
  | { type: "chunk"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string };
