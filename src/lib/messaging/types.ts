import type { AiMessage } from "../ai/types";
import type { SelectionAction } from "../selection/types";

export type ExtensionMessage =
  | { type: "ACTIVATE_ACTIVE_TAB_AGENT"; requestId: string }
  | { type: "EXTRACT_ACTIVE_PAGE"; requestId: string }
  | { type: "LOAD_MODELS"; requestId: string }
  | {
      type: "SELECTION_ACTION";
      requestId: string;
      action: SelectionAction;
      text: string;
      url: string;
      title: string;
      prompt: string;
    }
  | { type: "GET_PENDING_SELECTION_PROMPT" }
  | { type: "SELECTION_TOO_LONG"; requestId: string; maxLength: number }
  | { type: "CONTENT_AGENT_READY" }
  | { type: "EXTRACT_PAGE_CONTENT" }
  | { type: "TEST_CONNECTION"; requestId: string }
  | {
      type: "FORWARD_SELECTION_ACTION";
      requestId: string;
      prompt: string;
      title: string;
    };

export type AiPortRequest = {
  type: "AI_CHAT_REQUEST";
  requestId: string;
  messages: AiMessage[];
};

export type AiPortResponse =
  | { type: "AI_STREAM_CHUNK"; requestId: string; delta: string }
  | { type: "AI_STREAM_DONE"; requestId: string }
  | { type: "AI_STREAM_ERROR"; requestId: string; message: string };

export type PageExtractionResponse =
  | { title: string; content: string; url: string }
  | { error: string };

export type TestConnectionResponse =
  | { ok: true }
  | { ok: false; error: string };

export type LoadModelsResponse =
  | { ok: true; models: string[] }
  | { ok: false; error: string };
