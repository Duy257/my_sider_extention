import { describe, expect, it } from "vitest";
import { createDefaultSettings, createInitialPromptTemplates } from "../../src/lib/storage/defaults";
import { migrateStorageEnvelope } from "../../src/lib/storage/migrations";

describe("storage defaults", () => {
  it("creates custom provider settings with undefined customProvider by default", () => {
    const settings = createDefaultSettings("2026-06-24T00:00:00.000Z");

    expect(settings.provider).toBe("openai");
    expect(settings.customProvider).toBeUndefined();
  });

  it("creates OpenAI settings with gpt-5.4-mini as default preset", () => {
    const settings = createDefaultSettings("2026-06-24T00:00:00.000Z");

    expect(settings.provider).toBe("openai");
    expect(settings.modelPreset).toBe("gpt-5.4-mini");
    expect(settings.customModel).toBe("");
    expect(settings.defaultLanguage).toBe("vi");
    expect(settings.updatedAt).toBe("2026-06-24T00:00:00.000Z");
  });

  it("seeds five prompt templates with stable sort order", () => {
    const prompts = createInitialPromptTemplates("2026-06-24T00:00:00.000Z");

    expect(prompts).toHaveLength(5);
    expect(prompts.map((prompt) => prompt.sortOrder)).toEqual([0, 1, 2, 3, 4]);
    expect(prompts[0].name).toBe("CEO rewrite");
    expect(prompts[4].category).toBe("dev");
  });

  it("wraps legacy data in a schema envelope", () => {
    const migrated = migrateStorageEnvelope({ provider: "openai" }, 1);

    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.data).toEqual({ provider: "openai" });
  });
});
