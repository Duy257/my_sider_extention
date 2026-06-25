import { getDefaultProviderId } from "../ai/providers";
import { createSeedPromptTemplates } from "../prompts/seeds";
import type { Settings } from "./types";

export function createDefaultSettings(now = new Date().toISOString()): Settings {
  return {
    providerId: getDefaultProviderId(),
    apiKeys: {},
    selectedModels: {},
    defaultLanguage: "vi",
    updatedAt: now
  };
}

export function createInitialPromptTemplates(now = new Date().toISOString()) {
  return createSeedPromptTemplates(now);
}
