import React, { useCallback, useEffect, useRef, useState } from "react";

export interface UseDraggableOptions {
  initialPosition: { top: number; left: number };
  clampToViewport?: (top: number, left: number) => { top: number; left: number };
  disabled?: boolean;
}

export interface UseDraggableResult {
  pos: { top: number; left: number };
  setPos: React.Dispatch<React.SetStateAction<{ top: number; left: number }>>;
  isDragging: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
}

export function useDraggable({
  initialPosition,
  clampToViewport,
  disabled = false,
}: UseDraggableOptions): UseDraggableResult {
  const [pos, setPos] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);

  const posRef = useRef(pos);
  posRef.current = pos;

  const clampRef = useRef(clampToViewport);
  clampRef.current = clampToViewport;

  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startTop: number;
    startLeft: number;
  } | null>(null);

  const activeCleanupRef = useRef<(() => void) | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-window-control]")) return;

      // Clean up previous listeners if any existed
      if (activeCleanupRef.current) {
        activeCleanupRef.current();
      }

      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startTop: posRef.current.top,
        startLeft: posRef.current.left,
      };
      setIsDragging(true);

      const ac = new AbortController();

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragStateRef.current) return;
        const dx = ev.clientX - dragStateRef.current.startX;
        const dy = ev.clientY - dragStateRef.current.startY;
        const newTop = dragStateRef.current.startTop + dy;
        const newLeft = dragStateRef.current.startLeft + dx;
        const clamped = clampRef.current
          ? clampRef.current(newTop, newLeft)
          : { top: Math.max(0, newTop), left: Math.max(0, newLeft) };
        setPos(clamped);
      };

      const cleanup = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        try {
          ac.abort();
        } catch {}
        dragStateRef.current = null;
        setIsDragging(false);
        activeCleanupRef.current = null;
      };

      const onMouseUp = () => {
        cleanup();
      };

      activeCleanupRef.current = cleanup;

      document.addEventListener("mousemove", onMouseMove, { signal: ac.signal });
      document.addEventListener("mouseup", onMouseUp, { signal: ac.signal });
    },
    [disabled],
  );

  // Unmount cleanup: guarantees mousemove and mouseup listeners are removed
  useEffect(() => {
    return () => {
      if (activeCleanupRef.current) {
        activeCleanupRef.current();
      }
    };
  }, []);

  return {
    pos,
    setPos,
    isDragging,
    handleMouseDown,
  };
}
