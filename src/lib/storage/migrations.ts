import type { StorageEnvelope } from "./types";

export const CURRENT_SCHEMA_VERSION = 1;

export function migrateStorageEnvelope<T>(
  value: T | StorageEnvelope<T> | undefined,
  schemaVersion = CURRENT_SCHEMA_VERSION,
  fallbackData?: T
): StorageEnvelope<T> {
  if (value && typeof value === "object" && "schemaVersion" in value && "data" in value) {
    return value as StorageEnvelope<T>;
  }

  if (value === undefined) {
    if (fallbackData === undefined) {
      throw new Error("Cannot migrate undefined storage value without fallback data.");
    }
    return { schemaVersion, data: fallbackData };
  }

  return { schemaVersion, data: value as T };
}
