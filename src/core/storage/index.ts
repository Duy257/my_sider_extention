import { createDefaultSettings, createInitialPromptTemplates } from "./defaults";
import { CURRENT_SCHEMA_VERSION, migrateSettingsEnvelope, migrateStorageEnvelope } from "./migrations";
import { STORAGE_KEYS } from "../../constants";
import type { SavedResult, Settings, StorageEnvelope, StorageResult } from "./types";
import type { PromptTemplate } from "../prompts/types";

async function getLocal<T>(key: string): Promise<T | undefined> {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  } catch {
    return undefined;
  }
}

// Ghi dữ liệu vào storage và báo rõ kết quả — không bao giờ fail im lặng
async function setLocal<T>(key: string, value: T): Promise<StorageResult> {
  try {
    await chrome.storage.local.set({ [key]: value });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage error.";
    console.error(`Failed to save "${key}" to chrome.storage.local:`, error);
    return { ok: false, error: message };
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
    const stored = await getLocal<StorageEnvelope<Settings> | Settings>(STORAGE_KEYS.SETTINGS);
    const envelope = migrateSettingsEnvelope(stored, fallback);
    if (needsMigration(stored)) {
      // Ghi ngược envelope đã migrate là best-effort; lỗi đã được log trong setLocal
      await setLocal(STORAGE_KEYS.SETTINGS, envelope);
    }
    return envelope.data;
  } catch (error) {
    console.error("getSettings failed:", error);
    return createDefaultSettings();
  }
}

export async function saveSettings(settings: Settings): Promise<StorageResult> {
  return setLocal(STORAGE_KEYS.SETTINGS, { schemaVersion: CURRENT_SCHEMA_VERSION, data: settings });
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  try {
    const fallback = createInitialPromptTemplates();
    const stored = await getLocal<StorageEnvelope<PromptTemplate[]> | PromptTemplate[]>(STORAGE_KEYS.PROMPTS);
    const envelope = migrateStorageEnvelope(stored, CURRENT_SCHEMA_VERSION, fallback);
    if (needsMigration(stored)) {
      await setLocal(STORAGE_KEYS.PROMPTS, envelope);
    }
    return envelope.data;
  } catch (error) {
    console.error("getPromptTemplates failed:", error);
    return createInitialPromptTemplates();
  }
}

export async function savePromptTemplates(prompts: PromptTemplate[]): Promise<StorageResult> {
  return setLocal(STORAGE_KEYS.PROMPTS, { schemaVersion: CURRENT_SCHEMA_VERSION, data: prompts });
}

export async function getSavedResults(): Promise<SavedResult[]> {
  try {
    const stored = await getLocal<StorageEnvelope<SavedResult[]> | SavedResult[]>(STORAGE_KEYS.SAVED_RESULTS);
    const envelope = migrateStorageEnvelope(stored, CURRENT_SCHEMA_VERSION, []);
    if (needsMigration(stored)) {
      await setLocal(STORAGE_KEYS.SAVED_RESULTS, envelope);
    }
    return envelope.data;
  } catch (error) {
    console.error("getSavedResults failed:", error);
    return [];
  }
}

export async function saveSavedResults(results: SavedResult[]): Promise<StorageResult> {
  return setLocal(STORAGE_KEYS.SAVED_RESULTS, { schemaVersion: CURRENT_SCHEMA_VERSION, data: results });
}
