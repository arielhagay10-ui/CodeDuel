import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

export async function POST(request: Request, context: RouteContext<"/api/matches/[matchId]/messages/[messageId]/report">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { matchId, messageId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const category = typeof body === "object" && body && "category" in body ? (body as { category?: unknown }).category : null;
  if (category !== "abusive_behavior" && category !== "suspected_cheating" && category !== "other") return NextResponse.json({ error: "Invalid report." }, { status: 422 });
  const message = await getDb().query("SELECT 1 FROM match_messages m JOIN matches game ON game.id = m.match_id WHERE m.id = $1 AND m.match_id = $2 AND $3 IN (game.player_one_id, game.player_two_id) AND m.sender_id <> $3", [messageId, matchId, userId]);
  if (!message.rowCount) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  try {
    await getDb().query("INSERT INTO message_reports (id, message_id, reporter_id, category) VALUES ($1, $2, $3, $4)", [crypto.randomUUID(), messageId, userId, category]);
  } catch (caught) {
    if ((caught as { code?: string }).code === "23505") return NextResponse.json({ error: "You have already reported this message." }, { status: 409 });
    throw caught;
  }
  return new NextResponse(null, { status: 201 });
}
