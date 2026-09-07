import type { AiMessage } from "../ai/types";
import type { SelectionAction } from "../selection/types";
import type { Settings } from "../storage/types";
import type {
  AiDevContext,
  AiDevTrace,
  ToolDevTrace,
  TokenUsage,
} from "../devtools/types";

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
      messages: AiMessage[];
      position: { top: number; left: number };
    }
  | { type: "GET_PENDING_SELECTION_PROMPT" }
  | { type: "SELECTION_TOO_LONG"; requestId: string; maxLength: number }
  | { type: "CONTENT_AGENT_READY" }
  | { type: "EXTRACT_PAGE_CONTENT" }
  | { type: "TEST_CONNECTION"; requestId: string }
  | {
      type: "FORWARD_SELECTION_ACTION";
      requestId: string;
      messages: AiMessage[];
      title: string;
      actionPosition: { top: number; left: number };
    }
  | { type: "SETTINGS_UPDATED" }
  | { type: "OPEN_READING_COMPANION"; requestId: string }
  | { type: "READER_CONTENT_READY"; requestId: string }
  | {
      type: "LOAD_READER_CONTENT";
      requestId: string;
      title: string;
      url: string;
      content: string;
      excerpt: string;
      toolTrace?: ToolDevTrace;
    }
  | {
      type: "LOAD_READER_ERROR";
      requestId: string;
      error: string;
      toolTrace?: ToolDevTrace;
    }
  | {
      type: "READER_SAVE_SESSION";
      requestId: string;
      title: string;
      url: string;
      summary: string;
      date: string;
    };

export type AiPortRequest = {
  type: "AI_CHAT_REQUEST";
  requestId: string;
  sessionId?: string;
  messages: AiMessage[];
  thinkingMode?: Settings["thinkingMode"];
  devContext?: AiDevContext;
};

export type AiPortResponse =
  | { type: "AI_STREAM_CONNECTING"; requestId: string }
  | { type: "AI_STREAM_FIRST_TOKEN"; requestId: string }
  | { type: "AI_STREAM_DEBUG_START"; requestId: string; trace: AiDevTrace }
  | { type: "AI_STREAM_REASONING"; requestId: string; delta: string }
  | { type: "AI_STREAM_CHUNK"; requestId: string; delta: string }
  | {
      type: "AI_STREAM_DEBUG_UPDATE";
      requestId: string;
      usage?: TokenUsage;
      finishReason?: string;
    }
  | { type: "AI_STREAM_DONE"; requestId: string; trace?: AiDevTrace }
  | {
      type: "AI_STREAM_ERROR";
      requestId: string;
      message: string;
      trace?: AiDevTrace;
    };

export type PageExtractionResponse =
  | { title: string; content: string; url: string }
  | { error: string };

export type TestConnectionResponse =
  | { ok: true }
  | { ok: false; error: string };

export type LoadModelsResponse =
  | { ok: true; models: string[] }
  | { ok: false; error: string };
