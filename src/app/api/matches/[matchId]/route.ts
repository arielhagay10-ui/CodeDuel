import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

export async function GET(_request: Request, context: RouteContext<"/api/matches/[matchId]">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { matchId } = await context.params;
  const match = await getDb().query<{
    id: string; status: "waiting" | "active" | "between_rounds" | "completed" | "cancelled";
    difficulty: "easy" | "medium" | "advanced"; winner_id: string | null;
    lobby_ends_at: string | null; ready_window_ends_at: string | null; active_round_id: string | null; active_round_number: number | null;
    opponent_id: string; opponent_handle: string | null; opponent_tier: string | null; opponent_division: string | null;
    total_rounds: number; your_rounds_won: number; opponent_rounds_won: number; server_time: string;
  }>([
    "SELECT m.id, m.status, m.difficulty, m.winner_id, m.lobby_ends_at, m.ready_window_ends_at,",
    "active_round.id AS active_round_id, active_round.round_number AS active_round_number,",
    "opponent.id AS opponent_id, opponent.handle AS opponent_handle,",
    "opponent_rating.visible_tier AS opponent_tier, opponent_rating.visible_division AS opponent_division,",
    "count(rounds.id)::int AS total_rounds,",
    "count(rounds.id) FILTER (WHERE rounds.winner_id = $2)::int AS your_rounds_won,",
    "count(rounds.id) FILTER (WHERE rounds.winner_id = CASE WHEN m.player_one_id = $2 THEN m.player_two_id ELSE m.player_one_id END)::int AS opponent_rounds_won,",
    "now() AS server_time FROM matches m",
    "JOIN users opponent ON opponent.id = CASE WHEN m.player_one_id = $2 THEN m.player_two_id ELSE m.player_one_id END",
    "LEFT JOIN user_difficulty_ratings opponent_rating ON opponent_rating.user_id = opponent.id AND opponent_rating.difficulty = m.difficulty",
    "LEFT JOIN match_rounds rounds ON rounds.match_id = m.id",
    "LEFT JOIN match_rounds active_round ON active_round.match_id = m.id AND active_round.status = 'active'",
    "WHERE m.id = $1 AND $2 IN (m.player_one_id, m.player_two_id)",
    "GROUP BY m.id, active_round.id, opponent.id, opponent_rating.visible_tier, opponent_rating.visible_division",
  ].join(" "), [matchId, userId]);
  if (!match.rowCount) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  const value = match.rows[0];
  const readyRound = value.status === "waiting" ? 0 : value.status === "between_rounds" ? (await getDb().query<{ round_number: number }>("SELECT min(round_number) AS round_number FROM match_rounds WHERE match_id = $1 AND status = 'pending'", [matchId])).rows[0]?.round_number : null;
  const ready = readyRound === null ? [] : (await getDb().query<{ user_id: string }>("SELECT user_id FROM match_ready_ups WHERE match_id = $1 AND round_number = $2", [matchId, readyRound])).rows.map((row) => row.user_id);
  const outcome = value.status !== "completed"
    ? null
    : value.winner_id === null ? "draw" : value.winner_id === userId ? "win" : "loss";
  return NextResponse.json({
    id: value.id, status: value.status, difficulty: value.difficulty,
    opponent: { id: value.opponent_id, handle: value.opponent_handle ?? "Unknown", rank: value.opponent_tier ? { tier: value.opponent_tier, division: value.opponent_division } : null },
    totalRounds: value.total_rounds,
    roundsWonByYou: value.your_rounds_won,
    roundsWonByOpponent: value.opponent_rounds_won,
    outcome,
    lobbyEndsAt: value.lobby_ends_at,
    readyWindowEndsAt: value.ready_window_ends_at,
    activeRound: value.active_round_id ? { id: value.active_round_id, number: value.active_round_number } : null,
    youReady: ready.includes(userId),
    opponentReady: ready.some((id) => id !== userId),
    serverTime: value.server_time,
  });
}
