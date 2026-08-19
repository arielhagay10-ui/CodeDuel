import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const ratings = await getDb().query<{ difficulty: string; placement_matches_completed: number; visible_tier: string | null; visible_division: string | null }>(
    "SELECT difficulty, placement_matches_completed, visible_tier, visible_division FROM user_difficulty_ratings WHERE user_id = $1 ORDER BY difficulty",
    [userId],
  );
  return NextResponse.json({ ratings: ratings.rows.map((rating) => ({ difficulty: rating.difficulty, placementsCompleted: rating.placement_matches_completed, rank: rating.placement_matches_completed === 5 ? { tier: rating.visible_tier, division: rating.visible_division } : null })) });
}
