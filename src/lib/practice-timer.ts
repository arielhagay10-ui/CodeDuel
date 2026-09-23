import type { PracticeSession } from "./client-contracts.ts";

/** Interpolate a server stopwatch snapshot; completion freezes at submission time. */
export function practiceElapsedSeconds(session: PracticeSession, receivedAt: number, now: number) {
  return session.elapsedSeconds + (session.completedAt || session.abandonedAt ? 0 : Math.floor(Math.max(0, now - receivedAt) / 1000));
}
