import type { AiMessage } from "../ai/types";
import type { SelectionAction } from "../selection/types";

export type PagePromptInput = {
  title: string;
  url: string;
  text: string;
  warnings: string[];
};

const SYSTEM_MESSAGE =
  "You are a concise personal AI work assistant. Help the user read, understand, rewrite, analyze, and turn browser content into action. Prefer practical structure and clear next steps.";

export function buildUserChatMessages(input: string): AiMessage[] {
  return [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: input }
  ];
}

export function buildPagePrompt(input: PagePromptInput): string {
  const warningText = input.warnings.length
    ? `\nWarnings: ${input.warnings.join(" ")} Treat this as partial page content when relevant.\n`
    : "";

  return [
    "Read this page and summarize it from a CEO perspective.",
    "",
    `Title: ${input.title}`,
    `URL: ${input.url}`,
    warningText.trim(),
    "Return:",
    "1. Key points",
    "2. Applicable opportunities",
    "3. Implementation risks",
    "4. Immediate action items",
    "",
    "Page content:",
    input.text
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSelectionPrompt(action: SelectionAction, text: string): string {
  const instructions: Record<SelectionAction, string> = {
    explain: "Explain this selected text clearly and practically.",
    translate_vi: "Translate this selected text to Vietnamese while preserving meaning and tone.",
    rewrite_professional: "Rewrite this selected text more professionally. Keep it concise and readable.",
    summarize: "Summarize this selected text into the most important points.",
    action_list: "Convert this selected text into a bullet/action list with clear next steps."
  };

  return `${instructions[action]}\n\nSelected text:\n${text}`;
}
