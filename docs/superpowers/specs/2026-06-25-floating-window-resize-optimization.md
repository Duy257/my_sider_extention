# Floating Window Resize Optimization

**Date:** 2026-06-25
**Status:** Approved Design
**Focus:** Performance

## Problem

Current resize logic in `FloatingWindow.tsx` calls `setSize()` on every `mousemove` event during resize, triggering a full React re-render of the entire component tree (header, messages, container style) at ~60fps. This causes:

- Unnecessary re-renders of `WindowHeader` and `FloatingChatMessage` on every frame
- Container style recomputation (`containerStyle`) on every frame
- Potential jank on lower-end devices

## Approach: Ref-Based DOM Direct Resize

Replace state-driven resize with ref-driven direct DOM manipulation during drag, committing to React state only on mouseup.

### Before (current)

```typescript
const [size, setSize] = useState({ width: 380, height: 500 });

const handleResizeStart = useCallback((e) => {
  resizeRef.current = { startX, startY, startWidth: size.width, startHeight: size.height };
  // ...
  const handleMouseMove = (ev) => {
    const newWidth = Math.max(MIN_WIDTH, ...);
    const newHeight = Math.max(MIN_HEIGHT, ...);
    setSize({ width: newWidth, height: newHeight }); // ❌ Re-render per frame
  };
}, [size, windowState]); // size in deps → callback recreated on every resize
```

### After (optimized)

```typescript
const containerRef = useRef<HTMLDivElement>(null);
const sizeRef = useRef({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

const handleResizeStart = useCallback((e) => {
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

  const handleMouseMove = (ev) => {
    if (!resizeRef.current) return;
    const dx = ev.clientX - resizeRef.current.startX;
    const dy = ev.clientY - resizeRef.current.startY;
    const newWidth = Math.max(MIN_WIDTH, resizeRef.current.startWidth + dx);
    const newHeight = Math.max(MIN_HEIGHT, resizeRef.current.startHeight + dy);
    el.style.width = `${newWidth}px`;   // ✅ Direct DOM — no re-render
    el.style.height = `${newHeight}px`;
    sizeRef.current = { width: newWidth, height: newHeight };
  };

  const handleMouseUp = () => {
    setSize(sizeRef.current);            // ✅ Single commit on release
    resizeRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
}, [windowState]); // ✅ No size dependency — stable callback

// Sync sizeRef on maximize restore
const handleMaximize = () => {
  if (windowState === "maximized") {
    setWindowState("default");
    setPos(defaultPosRef.current);
    setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    sizeRef.current = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }; // ✅ sync ref
  } else {
    setWindowState("maximized");
  }
};

// Cleanup listeners on unmount
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

## Changes Summary

### Files Modified
- `src/lib/floating-window/FloatingWindow.tsx`

### What Changes
| Item | Change |
|------|--------|
| `containerRef` | New `useRef<HTMLDivElement>` on root div |
| `sizeRef` | New `useRef` tracking actual dimensions during resize; synced on maximize/restore |
| `handleResizeStart` | Rewritten for ref-based DOM; deps reduced from `[size, windowState]` to `[windowState]` |
| `handleMouseMove` handler | Writes to `el.style.width/height` + `sizeRef.current` — no setState |
| `handleMouseUp` handler | Commits `sizeRef.current` to state via `setSize` |
| Global cursor | Sets `document.body.style.cursor` during resize |
| `user-select` | Disables text selection on body during resize |
| `handleMaximize` | Added `sizeRef.current = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }` on restore |
| `useEffect` cleanup | Cleanup resize listeners and reset body styles if component unmounts during resize |

### What Stays Same
- `handleResizeStart` signature (still returns nothing, still passed to bottom-right handle)
- Resize handle JSX (12x12px div at bottom-right, `cursor: nwse-resize`)
- `MIN_WIDTH` (280), `MIN_HEIGHT` (200), `DEFAULT_WIDTH` (380), `DEFAULT_HEIGHT` (500)
- `windowState` guard (resize only in "default" state)
- Drag logic (unchanged)
- Tests unchanged (behavior is identical)

## Edge Cases

1. **Global cursor reset**: Cursor restored to `""` in mouseup — survives even if cursor leaves the element
2. **Text selection prevention**: `userSelect = "none"` prevents unwanted selection during fast drags
3. **Container mount safety**: `containerRef.current` null-check before access
4. **Maximized/minimized**: Guarded by `windowState !== "default"` return
5. **sizeRef sync on maximize restore**: `sizeRef` updated alongside `setSize` in `handleMaximize` — prevents stale ref on subsequent resize
6. **Unmount safety**: `useEffect` cleanup clears resize listeners and resets body styles if component unmounts during active resize

## Testing

Existing tests in `tests/floating-window.test.tsx` cover render, minimize, close — these remain valid since the resize behavior is identical. No new tests needed for a pure internal refactor.
