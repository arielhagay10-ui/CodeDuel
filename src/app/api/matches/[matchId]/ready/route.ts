import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

export async function POST(_request: Request, context: RouteContext<"/api/matches/[matchId]/ready">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { matchId } = await context.params;
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const match = await client.query<{ status: string; player_one_id: string; player_two_id: string; next_round: number | null }>(`
      SELECT m.status, m.player_one_id, m.player_two_id,
        CASE WHEN m.status = 'waiting' THEN 0 ELSE (SELECT min(round_number) FROM match_rounds WHERE match_id = m.id AND status = 'pending') END AS next_round
      FROM matches m WHERE m.id = $1 AND $2 IN (m.player_one_id, m.player_two_id) FOR UPDATE
    `, [matchId, userId]);
    const value = match.rows[0];
    if (!value || !["waiting", "between_rounds"].includes(value.status) || value.next_round === null) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This match is not waiting for readiness." }, { status: 409 });
    }
    await client.query("INSERT INTO match_ready_ups (match_id, round_number, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [matchId, value.next_round, userId]);
    await client.query("COMMIT");
    return NextResponse.json({ ready: true, roundNumber: value.next_round }, { status: 202 });
  } catch (caught) {
    await client.query("ROLLBACK");
    throw caught;
  } finally {
    client.release();
  }
}
