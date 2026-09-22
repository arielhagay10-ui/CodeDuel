import type { Difficulty, PracticeRun, RoundProblem } from "@/types/api";

export type AccountState = { user: { id: string; handle: string | null; rankedAccess: boolean; banned: boolean } | null };
export type PlacementAttempt = {
  id: string; difficulty: Difficulty; placementNumber: number;
  status: "active" | "completed" | "expired"; endsAt: string; serverTime: string;
  problem: RoundProblem; submitted: boolean;
  result: { testsPassed: number; testsTotal: number } | null;
};
export type PracticeResult = PracticeRun;
