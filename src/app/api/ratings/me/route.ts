import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const ratings = await getDb().query<{ difficulty: string; mmr: string; placement_matches_completed: number; visible_tier: string | null; visible_division: string | null }>(
    "SELECT difficulty, mmr, placement_matches_completed, visible_tier, visible_division FROM user_difficulty_ratings WHERE user_id = $1 ORDER BY difficulty",
    [userId],
  );
  return NextResponse.json({ ratings: ratings.rows.map((rating) => {
    const rank = rating.placement_matches_completed === 5 && rating.visible_tier ? { tier: rating.visible_tier, division: rating.visible_division } : null;
    const floorByRank: Record<string, number> = {
      "Bronze III": 900, "Bronze II": 1000, "Bronze I": 1100,
      "Silver III": 1200, "Silver II": 1300, "Silver I": 1400,
      "Gold III": 1500, "Gold II": 1600, "Gold I": 1700,
      "Platinum III": 1800, "Platinum II": 1900, "Platinum I": 2000,
      "Diamond III": 2100, "Diamond II": 2200, "Diamond I": 2300,
      "Master Coder": 2400,
    };
    const floor = rank ? floorByRank[[rank.tier, rank.division].filter(Boolean).join(" ")] : undefined;
    const rankProgressPoints = floor === undefined ? null : Math.max(0, Math.min(99, Math.floor(Number(rating.mmr)) - floor));
    return { difficulty: rating.difficulty, placementsCompleted: rating.placement_matches_completed, rank, rankProgressPoints };
  }) });
}
