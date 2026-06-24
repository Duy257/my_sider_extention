import type { PromptTemplate } from "../prompts/types";

export type AiProvider = "openai";

export type Settings = {
  provider: AiProvider;
  openaiApiKey?: string;
  modelPreset?: string;
  customModel?: string;
  defaultLanguage: "vi" | "en";
  updatedAt: string;
};

export type StorageEnvelope<T> = {
  schemaVersion: number;
  data: T;
};

export type SavedResult = {
  id: string;
  title: string;
  sourceType: "chat" | "page" | "selection";
  sourceUrl?: string;
  sourceTitle?: string;
  prompt?: string;
  inputExcerpt?: string;
  outputMarkdown: string;
  createdAt: string;
};

export type ExtensionStorage = {
  settings: StorageEnvelope<Settings>;
  promptTemplates: StorageEnvelope<PromptTemplate[]>;
  savedResults: StorageEnvelope<SavedResult[]>;
};
