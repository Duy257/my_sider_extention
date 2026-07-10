import { describe, expect, it } from "vitest";
import { createDefaultSettings } from "../../src/lib/storage/defaults";

describe("createDefaultSettings", () => {
  it("has thinkingMode off by default", () => {
    expect(createDefaultSettings("2026-07-10T00:00:00.000Z")).toMatchObject({
      thinkingMode: "off",
      devMode: false
    });
  });
});
