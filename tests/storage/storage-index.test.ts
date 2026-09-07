import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSavedResults, saveSavedResults, savePromptTemplates, saveSettings } from "../../src/core/storage";
import { createDefaultSettings } from "../../src/core/storage/defaults";

describe("storage index error handling (P0: silent-fail storage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok:true when a save succeeds", async () => {
    const result = await saveSavedResults([]);
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:false with the error message when chrome.storage.local.set rejects", async () => {
    (chrome.storage.local.set as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("QUOTA_BYTES exceeded"));

    const result = await saveSavedResults([
      { id: "1", title: "t", sourceType: "chat", outputMarkdown: "m", createdAt: "2026-01-01T00:00:00.000Z" }
    ]);

    expect(result).toEqual({ ok: false, error: "QUOTA_BYTES exceeded" });
  });

  it("propagates failures for saveSettings and savePromptTemplates", async () => {
    (chrome.storage.local.set as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("storage full"))
      .mockRejectedValueOnce(new Error("storage full"));

    await expect(saveSettings(createDefaultSettings())).resolves.toEqual({ ok: false, error: "storage full" });
    await expect(savePromptTemplates([])).resolves.toEqual({ ok: false, error: "storage full" });
  });

  it("falls back to defaults when reading fails", async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("read failed"));

    await expect(getSavedResults()).resolves.toEqual([]);
  });
});
