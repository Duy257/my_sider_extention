import { createDefaultSettings, createInitialPromptTemplates } from "./defaults";
import { CURRENT_SCHEMA_VERSION, migrateStorageEnvelope } from "./migrations";
import type { SavedResult, Settings, StorageEnvelope } from "./types";
import type { PromptTemplate } from "../prompts/types";

const SETTINGS_KEY = "settings";
const PROMPTS_KEY = "promptTemplates";
const SAVED_RESULTS_KEY = "savedResults";

async function getLocal<T>(key: string): Promise<T | undefined> {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  } catch {
    return undefined;
  }
}

async function setLocal<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch {
    // silently fail
  }
}

function needsMigration(stored: unknown): boolean {
  if (stored === undefined) return true;
  if (stored === null || typeof stored !== "object") return true;
  if (!("schemaVersion" in stored) || !("data" in stored)) return true;
  return (stored as StorageEnvelope<unknown>).schemaVersion !== CURRENT_SCHEMA_VERSION;
}

export async function getSettings(): Promise<Settings> {
  try {
    const fallback = createDefaultSettings();
    const stored = await getLocal<StorageEnvelope<Settings> | Settings>(SETTINGS_KEY);
    const envelope = migrateStorageEnvelope(stored, CURRENT_SCHEMA_VERSION, fallback);
    if (needsMigration(stored)) {
      await setLocal(SETTINGS_KEY, envelope);
    }
    return envelope.data;
  } catch (error) {
    console.error("getSettings failed:", error);
    return createDefaultSettings();
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await setLocal(SETTINGS_KEY, { schemaVersion: CURRENT_SCHEMA_VERSION, data: settings });
  } catch (error) {
    console.error("saveSettings failed:", error);
  }
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  try {
    const fallback = createInitialPromptTemplates();
    const stored = await getLocal<StorageEnvelope<PromptTemplate[]> | PromptTemplate[]>(PROMPTS_KEY);
    const envelope = migrateStorageEnvelope(stored, CURRENT_SCHEMA_VERSION, fallback);
    if (needsMigration(stored)) {
      await setLocal(PROMPTS_KEY, envelope);
    }
    return envelope.data;
  } catch (error) {
    console.error("getPromptTemplates failed:", error);
    return createInitialPromptTemplates();
  }
}

export async function savePromptTemplates(prompts: PromptTemplate[]): Promise<void> {
  try {
    await setLocal(PROMPTS_KEY, { schemaVersion: CURRENT_SCHEMA_VERSION, data: prompts });
  } catch (error) {
    console.error("savePromptTemplates failed:", error);
  }
}

export async function getSavedResults(): Promise<SavedResult[]> {
  try {
    const stored = await getLocal<StorageEnvelope<SavedResult[]> | SavedResult[]>(SAVED_RESULTS_KEY);
    const envelope = migrateStorageEnvelope(stored, CURRENT_SCHEMA_VERSION, []);
    if (needsMigration(stored)) {
      await setLocal(SAVED_RESULTS_KEY, envelope);
    }
    return envelope.data;
  } catch (error) {
    console.error("getSavedResults failed:", error);
    return [];
  }
}

export async function saveSavedResults(results: SavedResult[]): Promise<void> {
  try {
    await setLocal(SAVED_RESULTS_KEY, { schemaVersion: CURRENT_SCHEMA_VERSION, data: results });
  } catch (error) {
    console.error("saveSavedResults failed:", error);
  }
}
