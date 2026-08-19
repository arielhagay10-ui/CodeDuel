import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

const limits: Record<string, number> = { easy: 600, medium: 840, advanced: 1080 };

export async function POST(request: Request) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const body: unknown = await request.json().catch(() => null);
  const difficulty = typeof body === "object" && body && "difficulty" in body ? (body as { difficulty?: unknown }).difficulty : null;
  if (typeof difficulty !== "string" || !(difficulty in limits)) return NextResponse.json({ error: "Choose a valid difficulty." }, { status: 422 });
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const active = await client.query<{ id: string; placement_number: number; problem_id: string; ends_at: string }>("SELECT id, placement_number, problem_id, ends_at FROM placement_attempts WHERE user_id = $1 AND difficulty = $2 AND status = 'active' ORDER BY placement_number LIMIT 1 FOR UPDATE", [userId, difficulty]);
    if (active.rowCount) { await client.query("COMMIT"); return NextResponse.json({ attempt: active.rows[0] }); }
    const rating = await client.query<{ placement_matches_completed: number }>("SELECT placement_matches_completed FROM user_difficulty_ratings WHERE user_id = $1 AND difficulty = $2 FOR UPDATE", [userId, difficulty]);
    const completed = rating.rows[0]?.placement_matches_completed ?? 0;
    if (completed >= 5) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Placements are already complete." }, { status: 409 }); }
    const problem = await client.query<{ id: string }>("SELECT id FROM problems WHERE difficulty = $1 AND published_at IS NOT NULL AND retired_at IS NULL AND id NOT IN (SELECT problem_id FROM placement_attempts WHERE user_id = $2 AND difficulty = $1) ORDER BY random() LIMIT 1", [difficulty, userId]);
    if (!problem.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({ error: "No placement problem is available." }, { status: 503 }); }
    const attempt = { id: crypto.randomUUID(), placementNumber: completed + 1, problemId: problem.rows[0].id };
    const inserted = await client.query<{ ends_at: string }>("INSERT INTO placement_attempts (id, user_id, difficulty, placement_number, problem_id, ends_at) VALUES ($1, $2, $3, $4, $5, now() + ($6 * interval '1 second')) RETURNING ends_at", [attempt.id, userId, difficulty, attempt.placementNumber, attempt.problemId, limits[difficulty]]);
    await client.query("COMMIT");
    return NextResponse.json({ attempt: { ...attempt, endsAt: inserted.rows[0].ends_at } }, { status: 201 });
  } catch (caught) { await client.query("ROLLBACK"); throw caught; } finally { client.release(); }
}
