import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ScriptMain = () => void;

describe("active tab agent startup", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    delete (window as typeof window & { __personalAiSidebarAgentInstalled?: boolean }).__personalAiSidebarAgentInstalled;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not show an activation toast during automatic HTTPS injection", async () => {
    vi.stubGlobal("defineUnlistedScript", (main: ScriptMain) => main());

    await import("../entrypoints/active-tab-agent");

    expect(document.body.textContent).not.toContain("AI Assistant đã kích hoạt");
    expect(document.body.textContent).not.toContain("Hãy bôi đen văn bản");
  });

  it("installs selection listeners only once if the compatibility injection path runs again", async () => {
    const documentListenerSpy = vi.spyOn(document, "addEventListener");
    const windowListenerSpy = vi.spyOn(window, "addEventListener");
    vi.stubGlobal("defineUnlistedScript", (main: ScriptMain) => {
      main();
      main();
    });

    await import("../entrypoints/active-tab-agent");

    expect(documentListenerSpy.mock.calls.filter(([type]) => type === "selectionchange")).toHaveLength(1);
    expect(documentListenerSpy.mock.calls.filter(([type]) => type === "scroll")).toHaveLength(1);
    expect(documentListenerSpy.mock.calls.filter(([type]) => type === "mousedown")).toHaveLength(1);
    expect(documentListenerSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
    expect(windowListenerSpy.mock.calls.filter(([type]) => type === "resize")).toHaveLength(1);
  });
});
