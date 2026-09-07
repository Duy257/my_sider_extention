import { getDefaultProviderId, getProvider } from "../ai/providers";
import type { Settings, StorageEnvelope } from "./types";

export const CURRENT_SCHEMA_VERSION = 5;

const THINKING_MODES = new Set(["off", "low", "medium", "high", "max"]);

function readThinkingMode(value: unknown): Settings["thinkingMode"] {
  return typeof value === "string" && THINKING_MODES.has(value)
    ? value as Settings["thinkingMode"]
    : "off";
}

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
    thinkingMode: readThinkingMode(data.thinkingMode),
    devMode: data.devMode === true,
    updatedAt: trimString(data.updatedAt) ?? fallback.updatedAt
  };
}

export function migrateSettingsEnvelope(value: unknown, fallback: Settings): StorageEnvelope<Settings> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    data: migrateSettingsData(value, fallback)
  };
}

// === MIGRATION DỮ LIỆU THEO TỪNG BƯỚC VERSION ===
// Khi thay đổi shape dữ liệu của promptTemplates/savedResults, tăng CURRENT_SCHEMA_VERSION
// và đăng ký một migrator chuyển data từ version cũ sang version mới:
//
//   registerStorageDataMigration(5, (data) => transformV5DataToV6(data));
//
// Migrator được đặt khóa theo version NGUỒN của data và được áp dụng nối tiếp
// cho tới version đích, đảm bảo không bỏ sót bước chuyển đổi nào.
export type StorageDataMigrator = (data: unknown) => unknown;

const STORAGE_DATA_MIGRATIONS: Record<number, StorageDataMigrator> = {};

export function registerStorageDataMigration(fromVersion: number, migrator: StorageDataMigrator): void {
  STORAGE_DATA_MIGRATIONS[fromVersion] = migrator;
}

export function hasStorageDataMigration(fromVersion: number): boolean {
  return fromVersion in STORAGE_DATA_MIGRATIONS;
}

function applyStorageDataMigrations(data: unknown, fromVersion: number, targetVersion: number): unknown {
  let current = data;
  for (let version = fromVersion; version < targetVersion; version += 1) {
    const migrator = STORAGE_DATA_MIGRATIONS[version];
    if (migrator) {
      current = migrator(current);
    }
  }
  return current;
}

export function migrateStorageEnvelope<T>(
  value: T | StorageEnvelope<T> | undefined,
  schemaVersion = CURRENT_SCHEMA_VERSION,
  fallbackData?: T
): StorageEnvelope<T> {
  if (value !== null && typeof value === "object" && "schemaVersion" in value && "data" in value) {
    const envelope = value as StorageEnvelope<T>;
    const storedVersion = envelope.schemaVersion;

    // Nâng version từng bước qua các migration đã đăng ký (nếu có)
    if (typeof storedVersion === "number" && storedVersion < schemaVersion) {
      const data = applyStorageDataMigrations(envelope.data, storedVersion, schemaVersion);
      return { schemaVersion, data: data as T };
    }

    // Data mới hơn code (downgrade) hoặc đúng version: giữ nguyên data, chỉ tái gắn version
    return { schemaVersion, data: envelope.data };
  }

  if (value === undefined) {
    if (fallbackData === undefined) {
      throw new Error("Cannot migrate undefined storage value without fallback data.");
    }
    return { schemaVersion, data: fallbackData };
  }

  return { schemaVersion, data: value as T };
}
