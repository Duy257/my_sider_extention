export type AiRole = "system" | "user" | "assistant";

export type AiMessage = {
  role: AiRole;
  content: string;
};

export type AiStreamChunk =
  | { type: "chunk"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string };
