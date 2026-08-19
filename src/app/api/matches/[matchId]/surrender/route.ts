import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

export async function POST(_request: Request, context: RouteContext<"/api/matches/[matchId]/surrender">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { matchId } = await context.params;
  const result = await getDb().query<{ winner_id: string }>(`
    UPDATE matches SET status = 'completed', winner_id = CASE WHEN player_one_id = $2 THEN player_two_id ELSE player_one_id END,
      forfeited_at = now(), forfeit_reason = 'surrender', completed_at = now()
    WHERE id = $1 AND status IN ('waiting', 'active', 'between_rounds') AND $2 IN (player_one_id, player_two_id)
    RETURNING winner_id
  `, [matchId, userId]);
  if (!result.rowCount) return NextResponse.json({ error: "This match cannot be surrendered." }, { status: 409 });
  return NextResponse.json({ winnerId: result.rows[0].winner_id, forfeited: true });
}
