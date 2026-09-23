import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";

const difficulties = ["easy", "medium", "advanced"] as const;
const bands: [number, string, string | null][] = [
  [1000, "Bronze", "III"], [1100, "Bronze", "II"], [1200, "Bronze", "I"],
  [1300, "Silver", "III"], [1400, "Silver", "II"], [1500, "Silver", "I"],
  [1600, "Gold", "III"], [1700, "Gold", "II"], [1800, "Gold", "I"],
  [1900, "Platinum", "III"], [2000, "Platinum", "II"], [2100, "Platinum", "I"],
  [2200, "Diamond", "III"], [2300, "Diamond", "II"], [2400, "Diamond", "I"],
  [2500, "Master Coder", null],
];

function localOnly() {
  return process.env.NODE_ENV !== "production";
}

function rankFor(mmr: number) {
  const index = bands.findIndex(([ceiling]) => mmr < ceiling);
  const band = index === -1 ? null : bands[index];
  const previousFloor = band ? (index === 0 ? 900 : bands[index - 1][0]) : 2500;
  return {
    tier: band?.[1] ?? "Grandmaster Coder",
    division: band?.[2] ?? null,
    points: band ? Math.min(99, Math.floor(mmr - previousFloor)) : null,
  };
}

export async function GET() {
  if (!localOnly()) return new NextResponse(null, { status: 404 });
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const result = await getDb().query<{
    difficulty: string; mmr: string; rating_deviation: string; volatility: string;
    placement_matches_completed: number;
  }>(
    `SELECT difficulty, mmr, rating_deviation, volatility, placement_matches_completed
     FROM user_difficulty_ratings WHERE user_id = $1 ORDER BY difficulty`,
    [userId],
  );
  return NextResponse.json({ ratings: result.rows.map((row) => ({
    difficulty: row.difficulty,
    rating: Number(row.mmr),
    deviation: Number(row.rating_deviation),
    volatility: Number(row.volatility),
    placementsCompleted: row.placement_matches_completed,
    rank: rankFor(Number(row.mmr)),
  })) });
}

export async function PUT(request: Request) {
  if (!localOnly()) return new NextResponse(null, { status: 404 });
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { difficulty, rating, deviation } = body as Record<string, unknown>;
  if (!difficulties.includes(difficulty as (typeof difficulties)[number])) {
    return NextResponse.json({ error: "Choose a valid difficulty." }, { status: 400 });
  }
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 900 || rating > 3500 ||
      typeof deviation !== "number" || !Number.isFinite(deviation) || deviation < 30 || deviation > 350) {
    return NextResponse.json({ error: "Rating must be 900–3500 and deviation 30–350." }, { status: 400 });
  }
  const db = getDb();
  const updated = await db.query(
    `UPDATE user_difficulty_ratings SET mmr = $1, rating_deviation = $2,
       visible_tier = CASE WHEN placement_matches_completed = 5 THEN $3 ELSE visible_tier END,
       visible_division = CASE WHEN placement_matches_completed = 5 THEN $4 ELSE visible_division END
     WHERE user_id = $5 AND difficulty = $6 RETURNING difficulty`,
    [rating, deviation, rankFor(rating).tier, rankFor(rating).division, userId, difficulty],
  );
  if (!updated.rowCount) return NextResponse.json({ error: "Rating row not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
