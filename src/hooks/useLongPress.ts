import { useCallback, useRef } from "react";

/**
 * Long-press (1.2s di default) con fallback triplo click (entro 600ms).
 * Restituisce handler da spread su un elemento.
 */
export function useLongPress(onTrigger: () => void, ms = 1200) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const clicks = useRef<number[]>([]);

  const cancel = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const start = useCallback(() => {
    fired.current = false;
    cancel();
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onTrigger();
    }, ms);
  }, [onTrigger, ms]);

  const end = useCallback(() => {
    cancel();
    if (!fired.current) {
      const now = Date.now();
      clicks.current = [...clicks.current.filter((t) => now - t < 600), now];
      if (clicks.current.length >= 3) {
        clicks.current = [];
        onTrigger();
      }
    }
  }, [onTrigger]);

  return {
    onPointerDown: start,
    onPointerUp: end,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };
}
