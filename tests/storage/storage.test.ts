import { describe, expect, it } from "vitest";
import { createDefaultSettings, createInitialPromptTemplates } from "../../src/lib/storage/defaults";
import { CURRENT_SCHEMA_VERSION, migrateSettingsEnvelope, migrateStorageEnvelope } from "../../src/lib/storage/migrations";

describe("storage defaults", () => {
  it("creates provider-keyed settings", () => {
    const settings = createDefaultSettings("2026-06-25T00:00:00.000Z");

    expect(settings).toEqual({
      providerId: "openai",
      apiKeys: {},
      selectedModels: {},
      defaultLanguage: "vi",
      updatedAt: "2026-06-25T00:00:00.000Z"
    });
  });

  it("seeds five prompt templates with stable sort order", () => {
    const prompts = createInitialPromptTemplates("2026-06-24T00:00:00.000Z");

    expect(prompts).toHaveLength(5);
    expect(prompts.map((prompt) => prompt.sortOrder)).toEqual([0, 1, 2, 3, 4]);
    expect(prompts[0].name).toBe("Viết lại phong cách CEO");
    expect(prompts[4].category).toBe("dev");
  });

  it("keeps generic envelope migration for non-settings data", () => {
    const migrated = migrateStorageEnvelope({ provider: "openai" }, 1);

    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.data).toEqual({ provider: "openai" });
  });

  it("uses schema version 3", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });

  it("migrates v2 openai settings", () => {
    const migrated = migrateSettingsEnvelope({
      schemaVersion: 2,
      data: {
        provider: "openai",
        openaiApiKey: " sk-old ",
        modelPreset: "gpt-5.4-mini",
        customModel: "",
        defaultLanguage: "en",
        updatedAt: "2026-06-24T00:00:00.000Z"
      }
    }, createDefaultSettings("fallback"));

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.data).toEqual({
      providerId: "openai",
      apiKeys: { openai: "sk-old" },
      selectedModels: { openai: "gpt-5.4-mini" },
      defaultLanguage: "en",
      updatedAt: "2026-06-24T00:00:00.000Z"
    });
  });

  it("migrates matching legacy custom provider presets", () => {
    const migrated = migrateSettingsEnvelope({
      schemaVersion: 2,
      data: {
        provider: "custom",
        customProvider: {
          preset: "opencode",
          baseUrl: "https://api.opencode.ai/v1/chat/completions",
          apiKey: " sk-open ",
          model: "gpt-4o"
        },
        defaultLanguage: "vi",
        updatedAt: "2026-06-24T00:00:00.000Z"
      }
    }, createDefaultSettings("fallback"));

    expect(migrated.data.providerId).toBe("opencode");
    expect(migrated.data.apiKeys.opencode).toBe("sk-open");
    expect(migrated.data.selectedModels.opencode).toBe("gpt-4o");
  });

  it("falls back for unmatched legacy custom provider settings", () => {
    const migrated = migrateSettingsEnvelope({
      schemaVersion: 2,
      data: {
        provider: "custom",
        customProvider: { preset: "custom", baseUrl: "https://custom.test/v1/chat/completions", apiKey: "sk-custom", model: "m" },
        defaultLanguage: "vi",
        updatedAt: "2026-06-24T00:00:00.000Z"
      }
    }, createDefaultSettings("fallback"));

    expect(migrated.data.providerId).toBe("openai");
    expect(migrated.data.apiKeys).toEqual({});
    expect(migrated.data.selectedModels).toEqual({});
  });
});
