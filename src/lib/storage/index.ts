import { createDefaultSettings, createInitialPromptTemplates } from "./defaults";
import { CURRENT_SCHEMA_VERSION, migrateStorageEnvelope } from "./migrations";
import type { SavedResult, Settings, StorageEnvelope } from "./types";
import type { PromptTemplate } from "../prompts/types";

const SETTINGS_KEY = "settings";
const PROMPTS_KEY = "promptTemplates";
const SAVED_RESULTS_KEY = "savedResults";

async function getLocal<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

async function setLocal<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<Settings> {
  const fallback = createDefaultSettings();
  const stored = await getLocal<StorageEnvelope<Settings> | Settings>(SETTINGS_KEY);
  const envelope = migrateStorageEnvelope(stored, CURRENT_SCHEMA_VERSION, fallback);
  await setLocal(SETTINGS_KEY, envelope);
  return envelope.data;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setLocal(SETTINGS_KEY, { schemaVersion: CURRENT_SCHEMA_VERSION, data: settings });
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  const fallback = createInitialPromptTemplates();
  const stored = await getLocal<StorageEnvelope<PromptTemplate[]> | PromptTemplate[]>(PROMPTS_KEY);
  const envelope = migrateStorageEnvelope(stored, CURRENT_SCHEMA_VERSION, fallback);
  await setLocal(PROMPTS_KEY, envelope);
  return envelope.data;
}

export async function savePromptTemplates(prompts: PromptTemplate[]): Promise<void> {
  await setLocal(PROMPTS_KEY, { schemaVersion: CURRENT_SCHEMA_VERSION, data: prompts });
}

export async function getSavedResults(): Promise<SavedResult[]> {
  const stored = await getLocal<StorageEnvelope<SavedResult[]> | SavedResult[]>(SAVED_RESULTS_KEY);
  const envelope = migrateStorageEnvelope(stored, CURRENT_SCHEMA_VERSION, []);
  await setLocal(SAVED_RESULTS_KEY, envelope);
  return envelope.data;
}

export async function saveSavedResults(results: SavedResult[]): Promise<void> {
  await setLocal(SAVED_RESULTS_KEY, { schemaVersion: CURRENT_SCHEMA_VERSION, data: results });
}
