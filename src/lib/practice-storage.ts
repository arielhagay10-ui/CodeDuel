import type { PracticeRun } from "@/types/api";

const verdicts = new Set<PracticeRun["verdict"]>(["queued", "running", "accepted", "wrong_answer", "runtime_error", "time_limit_exceeded", "internal_error"]);

/** Device storage is optional and untrusted; never let it prevent editing. */
export function readPracticeRun(storage: Pick<Storage, "getItem">, key: string): PracticeRun | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? "null");
    if (!value || typeof value !== "object") return null;
    const run = value as PracticeRun;
    if (typeof run.id !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(run.id)
      || !verdicts.has(run.verdict) || !Number.isInteger(run.testsPassed) || !Number.isInteger(run.testsTotal)
      || run.testsPassed < 0 || run.testsTotal < run.testsPassed) return null;
    return { id: run.id, verdict: run.verdict, testsPassed: run.testsPassed, testsTotal: run.testsTotal };
  } catch { return null; }
}
