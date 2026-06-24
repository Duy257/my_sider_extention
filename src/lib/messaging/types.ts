import type { AiMessage } from "../ai/types";
import type { SelectionAction } from "../selection/types";

export type ExtensionMessage =
  | { type: "ACTIVATE_ACTIVE_TAB_AGENT"; requestId: string }
  | { type: "EXTRACT_ACTIVE_PAGE"; requestId: string }
  | {
      type: "SELECTION_ACTION";
      requestId: string;
      action: SelectionAction;
      text: string;
      url: string;
      title: string;
      prompt: string;
    };

export type AiPortRequest = {
  type: "AI_CHAT_REQUEST";
  requestId: string;
  messages: AiMessage[];
  model: string;
};

export type AiPortResponse =
  | { type: "AI_STREAM_CHUNK"; requestId: string; delta: string }
  | { type: "AI_STREAM_DONE"; requestId: string }
  | { type: "AI_STREAM_ERROR"; requestId: string; message: string };
