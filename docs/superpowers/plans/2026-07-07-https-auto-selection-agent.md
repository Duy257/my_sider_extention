# HTTPS Auto Selection Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the selection toolbar available automatically on HTTPS pages without requiring the side panel to be opened first.

**Architecture:** Keep the side panel as the extension icon entrypoint. Register the existing active tab agent script as a HTTPS content script through the manifest so it installs selection listeners on page load. Keep the existing background routing, floating window, and AI stream path, but remove the activation toast because automatic content-script execution would otherwise show it on every HTTPS page.

**Tech Stack:** WXT 0.20, Chrome Manifest V3, React 19, TypeScript 5, Vitest/jsdom.

## Global Constraints

- User-facing UI copy remains Vietnamese.
- Auto-run scope is HTTPS pages only: `https://*/*`.
- Do not auto-run on HTTP, localhost, or `file://` pages.
- Keep side panel manifest behavior unchanged: clicking the extension icon opens `sidepanel.html`.
- Keep the existing toolbar, selection length limits, floating window, and AI streaming flow.
- Do not add a new user preference for this behavior.
- Preserve unrelated working tree changes, including existing unstaged changes outside this feature.
- Run `npm run compile`, `npm test`, and `npm run build` before claiming implementation is complete.

---

## File Structure

Files to modify:

- `wxt.config.ts`: owns extension manifest config. Add `content_scripts` entry matching `https://*/*` and loading `active-tab-agent.js`. Keep `side_panel` and `action` unchanged.
- `entrypoints/active-tab-agent.ts`: owns page-level selection listener setup and floating window mount. Remove the activation toast block so automatic page injection is silent.

Files to create:

- `tests/wxt-config.test.ts`: verifies the manifest config preserves side panel behavior and registers the HTTPS content script.
- `tests/active-tab-agent.test.ts`: verifies automatic content-script startup does not render the activation toast and still guards against duplicate installation.

Files to verify but not modify unless tests reveal a real mismatch:

- `entrypoints/background.ts`: keep `ACTIVATE_ACTIVE_TAB_AGENT` compatibility and `SELECTION_ACTION` forwarding.
- `src/lib/selection/toolbar.ts`: keep current selection length behavior.
- `src/lib/floating-window/*`: keep current stream UI behavior.

---

### Task 1: Register Active Tab Agent As HTTPS Content Script

**Files:**

- Modify: `wxt.config.ts`
- Create: `tests/wxt-config.test.ts`

**Interfaces:**

- Consumes: WXT manifest object exported from `wxt.config.ts`.
- Produces: Manifest config with `content_scripts: [{ matches: ["https://*/*"], js: ["active-tab-agent.js"], run_at: "document_idle" }]` while keeping `side_panel.default_path === "sidepanel.html"`.

- [ ] **Step 1: Write failing manifest config test**

Create `tests/wxt-config.test.ts` with this exact content:

```typescript
import config from "../wxt.config";

type ManifestConfig = {
  manifest?: {
    side_panel?: { default_path?: string };
    content_scripts?: Array<{
      matches?: string[];
      js?: string[];
      run_at?: string;
    }>;
  };
};

describe("wxt manifest config", () => {
  const manifest = (config as ManifestConfig).manifest;

  it("keeps the side panel as the extension icon entrypoint", () => {
    expect(manifest?.side_panel).toEqual({ default_path: "sidepanel.html" });
  });

  it("registers the active tab agent on HTTPS pages only", () => {
    expect(manifest?.content_scripts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matches: ["https://*/*"],
          js: ["active-tab-agent.js"],
          run_at: "document_idle"
        })
      ])
    );
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
npm test -- tests/wxt-config.test.ts --run
```

Expected result: one test passes for `side_panel`, and the HTTPS content script test fails because `manifest.content_scripts` is currently `undefined`.

- [ ] **Step 3: Add the HTTPS content script manifest entry**

Replace `wxt.config.ts` with this exact content:

```typescript
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Personal AI Sidebar",
    description: "Private AI assistant for reading, rewriting, summarizing, and analysis workflows.",
    version: "0.1.0",
    permissions: ["storage", "activeTab", "sidePanel", "scripting"],
    host_permissions: ["https://api.openai.com/*", "https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
    content_scripts: [
      {
        matches: ["https://*/*"],
        js: ["active-tab-agent.js"],
        run_at: "document_idle"
      }
    ],
    side_panel: {
      default_path: "sidepanel.html"
    },
    action: {
      default_title: "Personal AI Sidebar"
    }
  }
});
```

- [ ] **Step 4: Run the manifest config test and verify it passes**

Run:

```bash
npm test -- tests/wxt-config.test.ts --run
```

Expected result: both tests pass.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git status --short
git diff -- wxt.config.ts tests/wxt-config.test.ts
git add wxt.config.ts tests/wxt-config.test.ts
git commit -m "feat: auto-register HTTPS selection agent"
```

Expected result: commit includes only `wxt.config.ts` and `tests/wxt-config.test.ts`.

---

### Task 2: Remove Activation Toast From Automatic Agent Startup

**Files:**

- Modify: `entrypoints/active-tab-agent.ts`
- Create: `tests/active-tab-agent.test.ts`

**Interfaces:**

- Consumes: `entrypoints/active-tab-agent.ts` default WXT script registration.
- Produces: page agent startup that installs selection listeners silently and keeps the duplicate guard through `window.__personalAiSidebarAgentInstalled`.

- [ ] **Step 1: Write failing tests for silent startup and duplicate guard**

Create `tests/active-tab-agent.test.ts` with this exact content:

```typescript
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
```

- [ ] **Step 2: Run the new active tab agent test and verify it fails**

Run:

```bash
npm test -- tests/active-tab-agent.test.ts --run
```

Expected result: the first test fails because `entrypoints/active-tab-agent.ts` currently appends the activation toast text to `document.body`.

- [ ] **Step 3: Remove the toast block from the content script**

In `entrypoints/active-tab-agent.ts`, remove lines 11-43, starting at:

```typescript
  // Show a premium toast notification indicating the agent is ready
  const toast = document.createElement("div");
```

and ending at:

```typescript
  }, 3000);
```

After removal, the top of `entrypoints/active-tab-agent.ts` must look like this:

```typescript
import { extractPageContent } from "../src/lib/extraction";
import { buildSelectionPrompt } from "../src/lib/prompts/builders";
import { isSelectionLengthAllowed, isSelectionTooLong, renderSelectionToolbar, renderTooLongIndicator } from "../src/lib/selection/toolbar";
import type { SelectionAction } from "../src/lib/selection/types";
import { mountFloatingWindow } from "../src/lib/floating-window/mount";

export default defineUnlistedScript(() => {
  if (window.__personalAiSidebarAgentInstalled) return;
  window.__personalAiSidebarAgentInstalled = true;

  let toolbar: HTMLElement | null = null;
  let tooLongIndicator: HTMLElement | null = null;
  let hideTimeoutId: number | null = null;
  let ignoreNextSelectionChange = false;
```

- [ ] **Step 4: Run the active tab agent tests and verify they pass**

Run:

```bash
npm test -- tests/active-tab-agent.test.ts --run
```

Expected result: both tests pass.

- [ ] **Step 5: Run the manifest config test again**

Run:

```bash
npm test -- tests/wxt-config.test.ts --run
```

Expected result: both tests pass.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git status --short
git diff -- entrypoints/active-tab-agent.ts tests/active-tab-agent.test.ts
git add entrypoints/active-tab-agent.ts tests/active-tab-agent.test.ts
git commit -m "fix: silence automatic selection agent startup"
```

Expected result: commit includes only `entrypoints/active-tab-agent.ts` and `tests/active-tab-agent.test.ts`.

---

### Task 3: Verify Build Manifest And Full Test Suite

**Files:**

- Verify: `.output/chrome-mv3/manifest.json`
- Verify: all implementation files from Tasks 1 and 2

**Interfaces:**

- Consumes: WXT build output.
- Produces: verified Chrome MV3 manifest with HTTPS content script and unchanged side panel entrypoint.

- [ ] **Step 1: Run TypeScript compile**

Run:

```bash
npm run compile
```

Expected result: exits 0 with no TypeScript errors.

- [ ] **Step 2: Run all tests**

Run:

```bash
npm test -- --run
```

Expected result: exits 0 and includes the new `tests/wxt-config.test.ts` and `tests/active-tab-agent.test.ts`.

- [ ] **Step 3: Build the Chrome extension**

Run:

```bash
npm run build
```

Expected result: exits 0 and creates `.output/chrome-mv3/manifest.json`.

- [ ] **Step 4: Verify the built manifest content script and side panel entries**

Run:

```bash
node -e "const fs=require('fs'); const manifest=JSON.parse(fs.readFileSync('.output/chrome-mv3/manifest.json','utf8')); const scripts=manifest.content_scripts||[]; const match=scripts.find((script)=>Array.isArray(script.matches)&&script.matches.includes('https://*/*')&&Array.isArray(script.js)&&script.js.includes('active-tab-agent.js')); if(!match){console.error(JSON.stringify(manifest.content_scripts,null,2)); process.exit(1);} if(manifest.side_panel?.default_path!=='sidepanel.html'){console.error(JSON.stringify(manifest.side_panel,null,2)); process.exit(1);} console.log('manifest ok');"
```

Expected result:

```text
manifest ok
```

- [ ] **Step 5: Check git status before final commit**

Run:

```bash
git status --short
```

Expected result: no unstaged changes from Tasks 1 or 2. Existing unrelated user changes, if any, may still appear and must not be staged.

- [ ] **Step 6: Commit verification docs only if the implementation changed the plan or docs**

If no docs changed during implementation, skip this step.

If docs changed, run:

```bash
git diff -- docs/superpowers/plans/2026-07-07-https-auto-selection-agent.md docs/superpowers/specs/2026-07-07-https-auto-selection-agent-design.md
git add docs/superpowers/plans/2026-07-07-https-auto-selection-agent.md docs/superpowers/specs/2026-07-07-https-auto-selection-agent-design.md
git commit -m "docs: update HTTPS selection agent plan"
```

Expected result: commit includes only docs files intentionally changed during execution.

---

## Manual QA

After Task 3 passes, load `.output/chrome-mv3/` in Chrome and verify these user flows:

- Open a normal HTTPS page without opening the extension side panel.
- Select 20 or more characters; the selection toolbar appears.
- Click one toolbar action; the floating AI window opens near the selection.
- Click the extension icon; the side panel still opens.
- Open an HTTP or localhost page; the toolbar is not auto-installed by the manifest path.
- Reload a HTTPS page; no activation toast appears.

## Self-Review Notes

- Spec coverage: Task 1 implements HTTPS auto-run and keeps side panel behavior; Task 2 removes the noisy activation toast and verifies duplicate guard behavior; Task 3 verifies compile, tests, build output, and manifest contents.
- Scope: this plan does not replace the side panel, change provider settings, alter prompt templates, or add a preference toggle.
- Type consistency: tests use existing file paths and existing `window.__personalAiSidebarAgentInstalled` guard; manifest assertions match the exact `content_scripts` shape added in Task 1.
