export type RankedDifficulty = "easy" | "medium" | "advanced";

export const roundLimitSeconds: Record<RankedDifficulty, number> = {
  easy: 5 * 60,
  medium: 10 * 60,
  advanced: 20 * 60,
};

export function roundsForDifficulty(difficulty: RankedDifficulty) {
  return difficulty === "advanced" ? 1 : 3;
}
