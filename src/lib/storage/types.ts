import type { PromptTemplate } from "../prompts/types";

export type AiProvider = "openai" | "custom";

export type CustomProviderConfig = {
  baseUrl: string;
  apiKey?: string;
  model: string;
};

export type Settings = {
  provider: AiProvider;
  openaiApiKey?: string;
  modelPreset?: string;
  customModel?: string;
  customProvider?: CustomProviderConfig;
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
