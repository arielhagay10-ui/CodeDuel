import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

const difficulties = new Set(["easy", "medium", "advanced"]);
type Difficulty = "easy" | "medium" | "advanced";

export async function POST(request: Request) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const body: unknown = await request.json().catch(() => null);
  const difficulty = typeof body === "object" && body && "difficulty" in body ? (body as { difficulty?: unknown }).difficulty : null;
  if (typeof difficulty !== "string" || !difficulties.has(difficulty)) return NextResponse.json({ error: "Choose a valid difficulty." }, { status: 422 });

  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const activeMatch = await client.query(
      "SELECT 1 FROM matches WHERE status IN ('waiting', 'active', 'between_rounds') AND $1 IN (player_one_id, player_two_id) FOR UPDATE",
      [userId],
    );
    if (activeMatch.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Finish or forfeit your current match before queueing." }, { status: 409 });
    }
    const rating = await client.query<{ mmr: string }>(
      "SELECT mmr FROM user_difficulty_ratings WHERE user_id = $1 AND difficulty = $2 AND placement_matches_completed = 5 FOR UPDATE",
      [userId, difficulty],
    );
    if (!rating.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Complete five placements for this difficulty first." }, { status: 403 });
    }
    const active = await client.query<{ id: string; match_id: string | null }>(
      "SELECT id, match_id FROM match_queue_entries WHERE user_id = $1 AND cancelled_at IS NULL AND matched_at IS NULL FOR UPDATE",
      [userId],
    );
    if (active.rowCount) {
      await client.query("COMMIT");
      return NextResponse.json({ queueEntryId: active.rows[0].id, matchId: active.rows[0].match_id, status: active.rows[0].match_id ? "matched" : "queued" });
    }

    const playerMmr = Number(rating.rows[0].mmr);
    const opponent = await client.query<{ id: string; user_id: string; queued_mmr: string }>(`
      SELECT q.id, q.user_id, q.queued_mmr
      FROM match_queue_entries q
      WHERE q.difficulty = $1 AND q.cancelled_at IS NULL AND q.matched_at IS NULL AND q.user_id <> $2
        AND abs(q.queued_mmr - $3) <= LEAST(400, 100 + FLOOR(EXTRACT(EPOCH FROM (now() - q.enqueued_at)) / 10) * 25)
      ORDER BY abs(q.queued_mmr - $3), q.enqueued_at
      FOR UPDATE SKIP LOCKED LIMIT 1
    `, [difficulty, userId, playerMmr]);

    if (!opponent.rowCount) {
      const queueEntryId = crypto.randomUUID();
      await client.query("INSERT INTO match_queue_entries (id, user_id, difficulty, queued_mmr) VALUES ($1, $2, $3, $4)", [queueEntryId, userId, difficulty, playerMmr]);
      await client.query("COMMIT");
      return NextResponse.json({ queueEntryId, status: "queued" }, { status: 202 });
    }

    const matchId = crypto.randomUUID();
    const problemCount = difficulty === "advanced" ? 1 : 3;
    const problems = await client.query<{ id: string }>(`
      SELECT p.id FROM problems p
      WHERE p.difficulty = $1 AND p.published_at IS NOT NULL AND p.retired_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM match_rounds old_round
          JOIN matches old_match ON old_match.id = old_round.match_id
          WHERE old_round.problem_id = p.id
            AND ((old_match.player_one_id = $2 AND old_match.player_two_id = $3) OR (old_match.player_one_id = $3 AND old_match.player_two_id = $2))
        )
      ORDER BY random() LIMIT $4
    `, [difficulty, userId, opponent.rows[0].user_id, problemCount]);
    if (problems.rowCount !== problemCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "No fresh published problems are available for this matchup." }, { status: 503 });
    }
    await client.query(`
      INSERT INTO matches (id, difficulty, player_one_id, player_two_id, player_one_mmr_before, player_two_mmr_before, lobby_ends_at)
      VALUES ($1, $2, $3, $4, $5, $6, now() + interval '60 seconds')
    `, [matchId, difficulty, opponent.rows[0].user_id, userId, opponent.rows[0].queued_mmr, playerMmr]);
    for (const [index, problem] of problems.rows.entries()) {
      await client.query("INSERT INTO match_rounds (id, match_id, problem_id, round_number) VALUES ($1, $2, $3, $4)", [crypto.randomUUID(), matchId, problem.id, index + 1]);
    }
    await client.query("UPDATE match_queue_entries SET matched_at = now(), match_id = $1 WHERE id = $2", [matchId, opponent.rows[0].id]);
    await client.query("COMMIT");
    return NextResponse.json({ matchId, status: "matched" }, { status: 201 });
  } catch (caught) {
    await client.query("ROLLBACK");
    throw caught;
  } finally {
    client.release();
  }
}

export async function GET() {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const entry = await getDb().query<{ id: string; difficulty: Difficulty; enqueued_at: string; match_id: string | null }>(
    "SELECT id, difficulty, enqueued_at, match_id FROM match_queue_entries WHERE user_id = $1 AND cancelled_at IS NULL ORDER BY enqueued_at DESC LIMIT 1",
    [userId],
  );
  if (!entry.rowCount) return NextResponse.json({ status: "idle" });
  return NextResponse.json({ queueEntryId: entry.rows[0].id, difficulty: entry.rows[0].difficulty, queuedAt: entry.rows[0].enqueued_at, matchId: entry.rows[0].match_id, status: entry.rows[0].match_id ? "matched" : "queued" });
}

export async function DELETE() {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  await getDb().query("UPDATE match_queue_entries SET cancelled_at = now() WHERE user_id = $1 AND cancelled_at IS NULL AND matched_at IS NULL", [userId]);
  return new NextResponse(null, { status: 204 });
}
