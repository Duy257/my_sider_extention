import type { StorageEnvelope } from "./types";

export const CURRENT_SCHEMA_VERSION = 2;

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
