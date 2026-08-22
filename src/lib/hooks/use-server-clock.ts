"use client";

import { useCallback, useRef } from "react";

/**
 * Corrects for clock skew between the browser and the server.
 *
 * The round timer must never be driven by Date.now() alone. A player whose system
 * clock runs slow would get extra seconds, and the server would auto-submit their
 * code while the UI still showed time remaining.
 */
export function useServerClock() {
  const offset = useRef(0);

  const sync = useCallback((serverTime: string) => {
    offset.current = Date.parse(serverTime) - Date.now();
  }, []);

  const secondsUntil = useCallback((iso: string | null) => {
    if (!iso) return null;
    return Math.max(0, Math.round((Date.parse(iso) - (Date.now() + offset.current)) / 1000));
  }, []);

  return { sync, secondsUntil };
}
