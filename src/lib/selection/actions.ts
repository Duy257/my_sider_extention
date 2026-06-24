import type { SelectionAction } from "./types";

export const SELECTION_ACTIONS: Array<{ action: SelectionAction; label: string }> = [
  { action: "explain", label: "Explain" },
  { action: "translate_vi", label: "Translate VI" },
  { action: "rewrite_professional", label: "Rewrite" },
  { action: "summarize", label: "Summarize" },
  { action: "action_list", label: "Action list" }
];
