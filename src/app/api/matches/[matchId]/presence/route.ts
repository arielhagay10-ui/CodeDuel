import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

export async function POST(request: Request, context: RouteContext<"/api/matches/[matchId]/presence">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { matchId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const connected = typeof body === "object" && body && "connected" in body ? (body as { connected?: unknown }).connected : null;
  if (typeof connected !== "boolean") return NextResponse.json({ error: "connected must be boolean." }, { status: 422 });
  const result = await getDb().query(`
    UPDATE matches SET player_one_disconnected_at = CASE WHEN player_one_id = $2 THEN CASE WHEN $3 THEN NULL ELSE COALESCE(player_one_disconnected_at, now()) END ELSE player_one_disconnected_at END,
      player_two_disconnected_at = CASE WHEN player_two_id = $2 THEN CASE WHEN $3 THEN NULL ELSE COALESCE(player_two_disconnected_at, now()) END ELSE player_two_disconnected_at END
    WHERE id = $1 AND status IN ('waiting', 'active', 'between_rounds') AND $2 IN (player_one_id, player_two_id)
    RETURNING id
  `, [matchId, userId, connected]);
  if (!result.rowCount) return NextResponse.json({ error: "This active match is unavailable." }, { status: 409 });
  return NextResponse.json({ connected });
}
