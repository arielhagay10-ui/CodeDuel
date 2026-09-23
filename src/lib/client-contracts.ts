import type { Difficulty, PracticeRun, RoundProblem } from "@/types/api";

export type AccountState = { user: { id: string; handle: string | null; rankedAccess: boolean; banned: boolean } | null };
export type PlacementAttempt = {
  id: string; difficulty: Difficulty; placementNumber: number;
  status: "active" | "completed" | "expired"; endsAt: string; serverTime: string;
  problem: RoundProblem; submitted: boolean;
  result: { testsPassed: number; testsTotal: number } | null;
};
export type PracticeResult = PracticeRun;
export type PracticeSession = { id: string; timed: boolean; startedAt: string; completedAt: string | null; abandonedAt: string | null; elapsedSeconds: number };
export type PracticeSessionState = {
  session: PracticeSession | null;
  activeTimed: (PracticeSession & { problemId: string; title: string }) | null;
  stats: { timedSolves: number; bestSeconds: number | null; abandonedAttempts: number; recent: { seconds: number; completedAt: string; firstSolve: boolean }[] };
  comparisons: { difficulty: Difficulty; tag: string | null; firstSolve: boolean; count: number; averageSeconds: number }[];
};
export type ProblemCatalogItem = { id: string; title: string; difficulty: Difficulty; summary: string; tags: string[] };
export type ProblemCatalogPage = { problems: ProblemCatalogItem[]; total: number; page: number; pageSize: number; availableTags: string[] };
