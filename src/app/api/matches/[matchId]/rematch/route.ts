import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

export async function POST(_request: Request, context: RouteContext<"/api/matches/[matchId]/rematch">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { matchId } = await context.params;
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const original = await client.query<{ difficulty: "easy" | "medium" | "advanced"; player_one_id: string; player_two_id: string }>(
      "SELECT difficulty, player_one_id, player_two_id FROM matches WHERE id = $1 AND status = 'completed' AND $2 IN (player_one_id, player_two_id) FOR UPDATE",
      [matchId, userId],
    );
    if (!original.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Rematches are available after a completed match." }, { status: 409 }); }
    const match = original.rows[0];
    await client.query("INSERT INTO match_rematch_requests (match_id, requester_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [matchId, userId]);
    const requests = await client.query<{ requester_id: string; rematch_id: string | null }>("SELECT requester_id, rematch_id FROM match_rematch_requests WHERE match_id = $1 FOR UPDATE", [matchId]);
    const alreadyCreated = requests.rows.find((item) => item.rematch_id)?.rematch_id;
    if (alreadyCreated) { await client.query("COMMIT"); return NextResponse.json({ accepted: true, matchId: alreadyCreated }); }
    if (requests.rows.length < 2) { await client.query("COMMIT"); return NextResponse.json({ accepted: true, waitingForOpponent: true }, { status: 202 }); }
    const ratings = await client.query<{ user_id: string; mmr: string }>("SELECT user_id, mmr FROM user_difficulty_ratings WHERE difficulty = $1 AND user_id IN ($2, $3) FOR UPDATE", [match.difficulty, match.player_one_id, match.player_two_id]);
    const byUser = new Map(ratings.rows.map((rating) => [rating.user_id, rating]));
    const count = match.difficulty === "advanced" ? 1 : 3;
    const problems = await client.query<{ id: string }>(`
      SELECT p.id FROM problems p WHERE p.difficulty = $1 AND p.published_at IS NOT NULL AND p.retired_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM match_rounds r JOIN matches previous ON previous.id = r.match_id WHERE r.problem_id = p.id AND ((previous.player_one_id = $2 AND previous.player_two_id = $3) OR (previous.player_one_id = $3 AND previous.player_two_id = $2)))
      ORDER BY random() LIMIT $4
    `, [match.difficulty, match.player_one_id, match.player_two_id, count]);
    if (problems.rowCount !== count) { await client.query("ROLLBACK"); return NextResponse.json({ error: "No fresh problems are available for this rematch." }, { status: 503 }); }
    const rematchId = crypto.randomUUID();
    await client.query("INSERT INTO matches (id, difficulty, player_one_id, player_two_id, player_one_mmr_before, player_two_mmr_before, lobby_ends_at) VALUES ($1, $2, $3, $4, $5, $6, now() + interval '60 seconds')", [rematchId, match.difficulty, match.player_one_id, match.player_two_id, byUser.get(match.player_one_id)?.mmr, byUser.get(match.player_two_id)?.mmr]);
    for (const [index, problem] of problems.rows.entries()) await client.query("INSERT INTO match_rounds (id, match_id, problem_id, round_number) VALUES ($1, $2, $3, $4)", [crypto.randomUUID(), rematchId, problem.id, index + 1]);
    await client.query("UPDATE match_rematch_requests SET rematch_id = $1 WHERE match_id = $2", [rematchId, matchId]);
    await client.query("COMMIT");
    return NextResponse.json({ accepted: true, matchId: rematchId }, { status: 201 });
  } catch (caught) {
    await client.query("ROLLBACK");
    throw caught;
  } finally { client.release(); }
}
