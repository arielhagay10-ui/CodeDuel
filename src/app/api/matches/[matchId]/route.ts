import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

export async function GET(_request: Request, context: RouteContext<"/api/matches/[matchId]">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { matchId } = await context.params;
  const match = await getDb().query<{
    status: string; difficulty: string; player_one_id: string; player_two_id: string; winner_id: string | null;
    lobby_ends_at: string | null; ready_window_ends_at: string | null; active_round_id: string | null; active_round_number: number | null;
  }>(`
    SELECT m.status, m.difficulty, m.player_one_id, m.player_two_id, m.winner_id, m.lobby_ends_at, m.ready_window_ends_at,
      r.id AS active_round_id, r.round_number AS active_round_number
    FROM matches m LEFT JOIN match_rounds r ON r.match_id = m.id AND r.status = 'active'
    WHERE m.id = $1 AND $2 IN (m.player_one_id, m.player_two_id)
  `, [matchId, userId]);
  if (!match.rowCount) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  const value = match.rows[0];
  const readyRound = value.status === "waiting" ? 0 : value.status === "between_rounds" ? (await getDb().query<{ round_number: number }>("SELECT min(round_number) AS round_number FROM match_rounds WHERE match_id = $1 AND status = 'pending'", [matchId])).rows[0]?.round_number : null;
  const ready = readyRound === null ? [] : (await getDb().query<{ user_id: string }>("SELECT user_id FROM match_ready_ups WHERE match_id = $1 AND round_number = $2", [matchId, readyRound])).rows.map((row) => row.user_id);
  const rematch = value.status === "completed" ? await getDb().query<{ requester_id: string; rematch_id: string | null }>("SELECT requester_id, rematch_id FROM match_rematch_requests WHERE match_id = $1", [matchId]) : null;
  return NextResponse.json({
    status: value.status, difficulty: value.difficulty, opponentId: userId === value.player_one_id ? value.player_two_id : value.player_one_id,
    winnerId: value.winner_id, lobbyEndsAt: value.lobby_ends_at, readyWindowEndsAt: value.ready_window_ends_at,
    activeRound: value.active_round_id ? { id: value.active_round_id, number: value.active_round_number } : null,
    youReady: ready.includes(userId), opponentReady: ready.some((id) => id !== userId),
    rematch: rematch ? { youRequested: rematch.rows.some((row) => row.requester_id === userId), opponentRequested: rematch.rows.some((row) => row.requester_id !== userId), matchId: rematch.rows.find((row) => row.rematch_id)?.rematch_id ?? null } : null,
  });
}
