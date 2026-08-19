import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

const categories = new Set(["suspected_cheating", "inappropriate_handle", "abusive_behavior", "other"]);

export async function POST(request: Request, context: RouteContext<"/api/matches/[matchId]/reports">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { matchId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const category = typeof body === "object" && body && "category" in body ? (body as { category?: unknown }).category : null;
  const details = typeof body === "object" && body && "details" in body ? (body as { details?: unknown }).details : null;
  if (typeof category !== "string" || !categories.has(category) || (details !== null && typeof details !== "string") || (typeof details === "string" && details.length > 1000)) return NextResponse.json({ error: "Invalid report." }, { status: 422 });
  const match = await getDb().query<{ player_one_id: string; player_two_id: string }>("SELECT player_one_id, player_two_id FROM matches WHERE id = $1 AND status = 'completed' AND $2 IN (player_one_id, player_two_id)", [matchId, userId]);
  if (!match.rowCount) return NextResponse.json({ error: "Reports are available after a completed match." }, { status: 403 });
  const reportedUserId = match.rows[0].player_one_id === userId ? match.rows[0].player_two_id : match.rows[0].player_one_id;
  try {
    await getDb().query("INSERT INTO player_reports (id, match_id, reporter_id, reported_user_id, category, details) VALUES ($1, $2, $3, $4, $5, $6)", [crypto.randomUUID(), matchId, userId, reportedUserId, category, typeof details === "string" ? details.trim() : null]);
  } catch (caught) {
    if ((caught as { code?: string }).code === "23505") return NextResponse.json({ error: "You have already reported this player for this match." }, { status: 409 });
    throw caught;
  }
  return new NextResponse(null, { status: 201 });
}
