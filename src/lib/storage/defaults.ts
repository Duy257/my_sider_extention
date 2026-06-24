import { createSeedPromptTemplates } from "../prompts/seeds";
import type { Settings } from "./types";

export function createDefaultSettings(now = new Date().toISOString()): Settings {
  return {
    provider: "openai",
    openaiApiKey: "",
    modelPreset: "gpt-5.4-mini",
    customModel: "",
    defaultLanguage: "vi",
    updatedAt: now
  };
}

export function createInitialPromptTemplates(now = new Date().toISOString()) {
  return createSeedPromptTemplates(now);
}
