import { describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  hasStorageDataMigration,
  migrateStorageEnvelope,
  registerStorageDataMigration,
} from "../../src/core/storage/migrations";

describe("migrateStorageEnvelope data migrations (P2: migration logic)", () => {
  it("passes data through unchanged for old versions without registered migrations", () => {
    const migrated = migrateStorageEnvelope<{ v: number }>(
      { schemaVersion: 2, data: { v: 1 } },
      CURRENT_SCHEMA_VERSION
    );

    expect(migrated).toEqual({ schemaVersion: CURRENT_SCHEMA_VERSION, data: { v: 1 } });
  });

  it("applies registered migrations stepwise from the stored version to the target", () => {
    registerStorageDataMigration(3, (data) => ({ ...(data as Record<string, unknown>), upgraded3: true }));
    registerStorageDataMigration(4, (data) => ({ ...(data as Record<string, unknown>), upgraded4: true }));

    expect(hasStorageDataMigration(3)).toBe(true);
    expect(hasStorageDataMigration(4)).toBe(true);
    expect(hasStorageDataMigration(2)).toBe(false);

    const migrated = migrateStorageEnvelope<Record<string, unknown>>(
      { schemaVersion: 3, data: { v: 1 } },
      CURRENT_SCHEMA_VERSION
    );

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // Migration cho v3 và v4 đều được áp dụng nối tiếp
    expect(migrated.data).toEqual({ v: 1, upgraded3: true, upgraded4: true });
  });

  it("retargets without transformation when stored version is newer than target (downgrade)", () => {
    const migrated = migrateStorageEnvelope<{ future: boolean }>(
      { schemaVersion: CURRENT_SCHEMA_VERSION + 3, data: { future: true } },
      CURRENT_SCHEMA_VERSION
    );

    expect(migrated).toEqual({ schemaVersion: CURRENT_SCHEMA_VERSION, data: { future: true } });
  });

  it("wraps raw (non-envelope) values into the target version", () => {
    const migrated = migrateStorageEnvelope({ provider: "openai" }, 1);

    expect(migrated).toEqual({ schemaVersion: 1, data: { provider: "openai" } });
  });

  it("uses fallbackData for undefined values and throws without a fallback", () => {
    const migrated = migrateStorageEnvelope<string[] | undefined>(undefined, CURRENT_SCHEMA_VERSION, []);

    expect(migrated).toEqual({ schemaVersion: CURRENT_SCHEMA_VERSION, data: [] });

    expect(() => migrateStorageEnvelope<unknown>(undefined, CURRENT_SCHEMA_VERSION)).toThrow(
      "Cannot migrate undefined storage value without fallback data."
    );
  });
});
