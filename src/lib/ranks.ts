export const rankTiers = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master Coder",
  "Grandmaster Coder",
] as const;

export type RankTier = (typeof rankTiers)[number];
export type Difficulty = "easy" | "medium" | "advanced";

export const PLACEMENT_MATCHES_REQUIRED = 5;

export type DifficultyRank = {
  difficulty: Difficulty;
  tier: RankTier | null;
  division: "III" | "II" | "I" | null;
  placementMatchesRemaining: number;
};

export const displayRank = (rank: DifficultyRank) => {
  if (rank.placementMatchesRemaining > 0) {
    return `${rank.placementMatchesRemaining} placement matches remaining`;
  }

  return [rank.tier, rank.division].filter(Boolean).join(" ");
};

export const isInPlacements = (rank: DifficultyRank) =>
  rank.placementMatchesRemaining > 0;
