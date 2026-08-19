import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

async function canChat(matchId: string, userId: string) {
  return getDb().query("SELECT 1 FROM matches WHERE id = $1 AND status = 'between_rounds' AND $2 IN (player_one_id, player_two_id)", [matchId, userId]);
}

export async function GET(_request: Request, context: RouteContext<"/api/matches/[matchId]/messages">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { matchId } = await context.params;
  if (!(await canChat(matchId, userId)).rowCount) return NextResponse.json({ error: "Chat is available only between rounds." }, { status: 403 });
  const messages = await getDb().query<{ id: string; sender_id: string; body: string; created_at: string }>(
    "SELECT id, sender_id, body, created_at FROM match_messages WHERE match_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 100",
    [matchId],
  );
  return NextResponse.json({ messages: messages.rows.map((message) => ({ id: message.id, senderId: message.sender_id, body: message.body, createdAt: message.created_at })) });
}

export async function POST(request: Request, context: RouteContext<"/api/matches/[matchId]/messages">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { matchId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const text = typeof body === "object" && body && "body" in body ? (body as { body?: unknown }).body : null;
  if (typeof text !== "string" || !text.trim() || text.trim().length > 300) return NextResponse.json({ error: "Messages must contain 1–300 characters." }, { status: 422 });
  if (!(await canChat(matchId, userId)).rowCount) return NextResponse.json({ error: "Chat is available only between rounds." }, { status: 403 });
  const lastMessage = await getDb().query("SELECT 1 FROM match_messages WHERE match_id = $1 AND sender_id = $2 AND created_at > now() - interval '2 seconds'", [matchId, userId]);
  if (lastMessage.rowCount) return NextResponse.json({ error: "Please wait before sending another message." }, { status: 429 });
  const message = await getDb().query<{ id: string; created_at: string }>("INSERT INTO match_messages (id, match_id, sender_id, body) VALUES ($1, $2, $3, $4) RETURNING id, created_at", [crypto.randomUUID(), matchId, userId, text.trim()]);
  return NextResponse.json({ id: message.rows[0].id, senderId: userId, body: text.trim(), createdAt: message.rows[0].created_at }, { status: 201 });
}
