# Floating Window Resize Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate React re-renders during floating window resize by switching from state-driven to ref-driven DOM manipulation.

**Architecture:** Add `containerRef` (root div) + `sizeRef` (dimensions tracker). Resize mousemove handler writes directly to `el.style.width/height` and `sizeRef.current` — zero re-renders during drag. On mouseup, commit final size to React state via `setSize`. Sync `sizeRef` on maximize restore.

**Tech Stack:** React 19, TypeScript 5

## Global Constraints

- Single file change: `src/lib/floating-window/FloatingWindow.tsx`
- No new dependencies
- Drag logic unchanged
- Existing tests must pass unchanged
- `MIN_WIDTH` = 280, `MIN_HEIGHT` = 200, `DEFAULT_WIDTH` = 380, `DEFAULT_HEIGHT` = 500

---

### Task 1: Refactor resize to ref-based DOM direct

**Files:**
- Modify: `src/lib/floating-window/FloatingWindow.tsx`

**Interfaces:**
- Consumes: existing `WindowState`, `StreamState` types; existing `MIN_WIDTH`, `MIN_HEIGHT`, `DEFAULT_WIDTH`, `DEFAULT_HEIGHT` constants
- Produces: `handleResizeStart` (unchanged signature — `(e: React.MouseEvent) => void`), `handleMaximize` (unchanged signature)

- [ ] **Step 1: Add refs and update imports**

Add `containerRef` and `sizeRef` after existing `resizeRef` (line 83):

```typescript
const containerRef = useRef<HTMLDivElement>(null);
const sizeRef = useRef({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
```

- [ ] **Step 2: Rewrite `handleResizeStart`**

Replace the existing handler (lines 185-205) with ref-based implementation:

```typescript
const handleResizeStart = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  if (windowState !== "default") return;
  const el = containerRef.current;
  if (!el) return;

  resizeRef.current = {
    startX: e.clientX, startY: e.clientY,
    startWidth: sizeRef.current.width,
    startHeight: sizeRef.current.height,
  };

  document.body.style.cursor = "nwse-resize";
  document.body.style.userSelect = "none";

  const handleMouseMove = (ev: MouseEvent) => {
    if (!resizeRef.current) return;
    const dx = ev.clientX - resizeRef.current.startX;
    const dy = ev.clientY - resizeRef.current.startY;
    const newWidth = Math.max(MIN_WIDTH, resizeRef.current.startWidth + dx);
    const newHeight = Math.max(MIN_HEIGHT, resizeRef.current.startHeight + dy);
    el.style.width = `${newWidth}px`;
    el.style.height = `${newHeight}px`;
    sizeRef.current = { width: newWidth, height: newHeight };
  };

  const handleMouseUp = () => {
    setSize(sizeRef.current);
    resizeRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
}, [windowState]);
```

- [ ] **Step 3: Add `containerRef` to the root div**

Find the root div in the JSX return (line 264). Add `ref={containerRef as React.RefObject<HTMLDivElement>}`:

```typescript
<div style={containerStyle} onKeyDown={handleKeyDown} tabIndex={0} ref={containerRef as React.RefObject<HTMLDivElement>}>
```

- [ ] **Step 4: Update `handleMaximize` to sync `sizeRef`**

Replace `handleMaximize` (lines 253-261):

```typescript
const handleMaximize = useCallback(() => {
  if (windowState === "maximized") {
    setWindowState("default");
    setPos(defaultPosRef.current);
    setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    sizeRef.current = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  } else {
    setWindowState("maximized");
  }
}, [windowState]);
```

- [ ] **Step 5: Add unmount cleanup useEffect**

Add after `handleMaximize` (or near other useEffects):

```typescript
useEffect(() => {
  return () => {
    if (resizeRef.current) {
      resizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  };
}, []);
```

- [ ] **Step 6: Remove `size` from `handleResizeStart` dep array**

Verify the `handleResizeStart` `useCallback` dependency is now `[windowState]` only (not `[size, windowState]`). The `setSize` in `handleMouseUp` ensures React state stays in sync.

- [ ] **Step 7: Run tests**

```bash
npm test -- tests/floating-window.test.tsx
```

Expected: All 3 tests pass (render, minimize, close).

- [ ] **Step 8: Type check**

```bash
npm run compile
```

Expected: No type errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/floating-window/FloatingWindow.tsx
git commit -m "perf: refactor resize to ref-based DOM direct — zero re-renders during drag"
```
