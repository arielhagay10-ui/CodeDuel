"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api-client";
import { useServerClock } from "@/lib/hooks/use-server-clock";
import type { MatchState, RoundState } from "@/types/api";

const POLL_MS = 2_000;
const TICK_MS = 1_000;

export type Polled<T> = {
  data: T | null;
  error: string | null;
  failures: number;
  refresh: () => Promise<void>;
  /** Seconds remaining until an ISO timestamp, corrected for server clock skew. */
  secondsUntil: (iso: string | null) => number | null;
};

/** Tagged with the id it came from, so navigating to a new round never shows the old one. */
type Entry<T> = { id: string; value: T | null; error: string | null; failures: number };

type Poller = { stop: () => void; refresh: () => Promise<void> };

/**
 * The polling loop, deliberately outside React.
 *
 * There are no WebSockets in this project, so a live view is a repeated GET.
 * Treating that as an external subscription — start it, hand it callbacks, stop
 * it — keeps the React side to one effect, and means swapping in SSE later is a
 * change to this function and nothing else.
 */
function startPolling<T>(
  id: string,
  load: (id: string) => Promise<T>,
  isSettled: (value: T) => boolean,
  onValue: (value: T) => void,
  onError: (message: string) => void,
): Poller {
  let cancelled = false;
  let settled = false;
  let inFlight = false;

  const run = async () => {
    // A slow response must not queue another request behind it.
    if (cancelled || inFlight) return;
    inFlight = true;
    try {
      const value = await load(id);
      if (cancelled) return;
      // A completed match, or a revealed round, has nothing left to say.
      if (isSettled(value)) settled = true;
      onValue(value);
    } catch (cause) {
      if (!cancelled) onError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      inFlight = false;
    }
  };

  void run();
  const timer = window.setInterval(() => { if (!settled) void run(); }, POLL_MS);

  return {
    stop: () => { cancelled = true; window.clearInterval(timer); },
    refresh: async () => { settled = false; await run(); },
  };
}

function usePolled<T extends { serverTime: string }>(
  id: string | null,
  load: (id: string) => Promise<T>,
  isSettled: (value: T) => boolean,
): Polled<T> {
  const [entry, setEntry] = useState<Entry<T> | null>(null);
  const { sync, secondsUntil } = useServerClock();
  const poller = useRef<Poller | null>(null);
  const [, tick] = useState(0);

  const handleValue = useCallback((target: string, value: T) => {
    sync(value.serverTime);
    setEntry({ id: target, value, error: null, failures: 0 });
  }, [sync]);

  const handleError = useCallback((target: string, message: string) => {
    setEntry((previous) => ({ id: target, value: previous?.id === target ? previous.value : null, error: message, failures: previous?.id === target ? previous.failures + 1 : 1 }));
  }, []);

  useEffect(() => {
    if (!id) return;
    const active = startPolling(
      id,
      load,
      isSettled,
      (value) => handleValue(id, value),
      (message) => handleError(id, message),
    );
    poller.current = active;
    return () => { poller.current = null; active.stop(); };
  }, [handleError, handleValue, id, isSettled, load]);

  // A separate beat purely so the countdown ticks smoothly between polls,
  // instead of jumping two seconds at a time.
  useEffect(() => {
    const beat = window.setInterval(() => tick((value) => value + 1), TICK_MS);
    return () => window.clearInterval(beat);
  }, []);

  const refresh = useCallback(async () => { await poller.current?.refresh(); }, []);

  // Derived rather than reset in an effect, so a stale value is never rendered
  // for even one frame after the id changes.
  const current = entry && entry.id === id ? entry : null;
  return { data: current?.value ?? null, error: current?.error ?? null, failures: current?.failures ?? 0, refresh, secondsUntil };
}

const matchSettled = (match: MatchState) => match.status === "completed" || match.status === "cancelled";
const roundSettled = (round: RoundState) => round.revealed;

export function useMatchState(matchId: string | null): Polled<MatchState> {
  return usePolled(matchId, api.getMatch, matchSettled);
}

export function useRoundState(roundId: string | null): Polled<RoundState> {
  return usePolled(roundId, api.getRound, roundSettled);
}
