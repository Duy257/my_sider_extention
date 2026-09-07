import React, { useCallback, useEffect, useRef, useState } from "react";

export interface UseResizableOptions {
  initialSize?: { width: number; height: number };
  minWidth?: number;
  minHeight?: number;
  disabled?: boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
  onResizeEnd?: (newSize: { width: number; height: number }) => void;
}

export interface UseResizableResult {
  size: { width: number; height: number };
  setSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
  sizeRef: React.MutableRefObject<{ width: number; height: number }>;
  isResizing: boolean;
  handleResizeStart: (e: React.MouseEvent) => void;
}

export function useResizable({
  initialSize = { width: 380, height: 500 },
  minWidth = 280,
  minHeight = 200,
  disabled = false,
  containerRef,
  onResizeEnd,
}: UseResizableOptions = {}): UseResizableResult {
  const [size, setSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);

  const sizeRef = useRef(initialSize);

  const activeCleanupRef = useRef<(() => void) | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;

      const el = containerRef?.current;

      // Clean up previous listeners if any existed
      if (activeCleanupRef.current) {
        activeCleanupRef.current();
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = sizeRef.current.width;
      const startHeight = sizeRef.current.height;

      document.body.style.cursor = "nwse-resize";
      document.body.style.userSelect = "none";
      setIsResizing(true);

      const ac = new AbortController();

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const newWidth = Math.max(minWidth, startWidth + dx);
        const newHeight = Math.max(minHeight, startHeight + dy);

        if (el) {
          el.style.width = `${newWidth}px`;
          el.style.height = `${newHeight}px`;
        }
        sizeRef.current = { width: newWidth, height: newHeight };
      };

      const cleanup = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        try {
          ac.abort();
        } catch {}
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setIsResizing(false);
        activeCleanupRef.current = null;
      };

      const onMouseUp = () => {
        const finalSize = { ...sizeRef.current };
        setSize(finalSize);
        onResizeEnd?.(finalSize);
        cleanup();
      };

      activeCleanupRef.current = cleanup;

      document.addEventListener("mousemove", onMouseMove, { signal: ac.signal });
      document.addEventListener("mouseup", onMouseUp, { signal: ac.signal });
    },
    [disabled, containerRef, minWidth, minHeight, onResizeEnd],
  );

  // Unmount cleanup: guarantees active listeners removed and body styles restored
  useEffect(() => {
    return () => {
      if (activeCleanupRef.current) {
        activeCleanupRef.current();
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return {
    size,
    setSize,
    sizeRef,
    isResizing,
    handleResizeStart,
  };
}
