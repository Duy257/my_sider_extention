import { getDefaultProviderId, getProvider } from "../ai/providers";
import type { Settings, StorageEnvelope } from "./types";

export const CURRENT_SCHEMA_VERSION = 3;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function trimString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readData(value: unknown): unknown {
  const record = asRecord(value);
  return "data" in record ? record.data : value;
}

function normalizeProviderId(providerId: unknown): string {
  const candidate = trimString(providerId);
  if (candidate && getProvider(candidate)) return candidate;
  return getDefaultProviderId();
}

export function migrateSettingsData(value: unknown, fallback: Settings): Settings {
  const data = asRecord(readData(value));
  const apiKeys: Record<string, string | undefined> = {};
  const selectedModels: Record<string, string | undefined> = {};
  let providerId = normalizeProviderId(data.providerId);

  const storedApiKeys = asRecord(data.apiKeys);
  for (const [key, value] of Object.entries(storedApiKeys)) {
    const apiKey = trimString(value);
    if (apiKey && getProvider(key)) apiKeys[key] = apiKey;
  }

  const storedModels = asRecord(data.selectedModels);
  for (const [key, value] of Object.entries(storedModels)) {
    const model = trimString(value);
    if (model && getProvider(key)) selectedModels[key] = model;
  }

  if (data.provider === "openai") {
    providerId = "openai";
    const apiKey = trimString(data.openaiApiKey);
    if (apiKey) apiKeys.openai = apiKey;
    const model = trimString(data.customModel) ?? trimString(data.modelPreset);
    if (model) selectedModels.openai = model;
  }

  if (data.provider === "custom") {
    const customProvider = asRecord(data.customProvider);
    const preset = trimString(customProvider.preset);
    if (preset && getProvider(preset)) {
      providerId = preset;
      const apiKey = trimString(customProvider.apiKey);
      const model = trimString(customProvider.model);
      if (apiKey) apiKeys[preset] = apiKey;
      if (model) selectedModels[preset] = model;
    } else {
      providerId = getDefaultProviderId();
    }
  }

  return {
    providerId,
    apiKeys,
    selectedModels,
    defaultLanguage: data.defaultLanguage === "en" ? "en" : "vi",
    updatedAt: trimString(data.updatedAt) ?? fallback.updatedAt
  };
}

export function migrateSettingsEnvelope(value: unknown, fallback: Settings): StorageEnvelope<Settings> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    data: migrateSettingsData(value, fallback)
  };
}

export function migrateStorageEnvelope<T>(
  value: T | StorageEnvelope<T> | undefined,
  schemaVersion = CURRENT_SCHEMA_VERSION,
  fallbackData?: T
): StorageEnvelope<T> {
  if (value !== null && typeof value === "object" && "schemaVersion" in value && "data" in value) {
    const envelope = value as StorageEnvelope<T>;
    if (envelope.schemaVersion !== schemaVersion) {
      return { schemaVersion, data: envelope.data };
    }
    return envelope;
  }

  if (value === undefined) {
    if (fallbackData === undefined) {
      throw new Error("Cannot migrate undefined storage value without fallback data.");
    }
    return { schemaVersion, data: fallbackData };
  }

  return { schemaVersion, data: value as T };
}
