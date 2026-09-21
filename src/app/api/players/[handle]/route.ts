import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";
import type { PlayerProfile } from "@/types/api";

export async function GET(_request: Request, context: RouteContext<"/api/players/[handle]">) {
  if (!await requireUserId()) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { handle } = await context.params;
  const db = getDb();
  const player = await db.query<{ id: string; handle: string }>(
    "SELECT id, handle FROM users WHERE lower(handle) = lower($1) AND banned_at IS NULL",
    [handle],
  );
  if (!player.rowCount) return NextResponse.json({ error: "Player not found." }, { status: 404 });
  const user = player.rows[0];
  const [ratings, matches] = await Promise.all([
    db.query<{ difficulty: "easy" | "medium" | "advanced"; placement_matches_completed: number; visible_tier: string | null; visible_division: string | null }>(
      "SELECT difficulty, placement_matches_completed, visible_tier, visible_division FROM user_difficulty_ratings WHERE user_id = $1 ORDER BY difficulty",
      [user.id],
    ),
    db.query<{ id: string; difficulty: "easy" | "medium" | "advanced"; winner_id: string | null; completed_at: string; opponent_handle: string }>(`
      SELECT m.id, m.difficulty, m.winner_id, m.completed_at,
        CASE WHEN m.player_one_id = $1 THEN opponent.handle ELSE challenger.handle END AS opponent_handle
      FROM matches m
      JOIN users challenger ON challenger.id = m.player_one_id
      JOIN users opponent ON opponent.id = m.player_two_id
      WHERE $1 IN (m.player_one_id, m.player_two_id) AND m.status = 'completed' AND m.completed_at IS NOT NULL
      ORDER BY m.completed_at DESC LIMIT 10
    `, [user.id]),
  ]);
  const response: PlayerProfile = {
    handle: user.handle,
    ranks: ratings.rows.map((rating) => ({
      difficulty: rating.difficulty,
      rank: rating.placement_matches_completed === 5 && rating.visible_tier ? { tier: rating.visible_tier, division: rating.visible_division } : null,
    })),
    recentMatches: matches.rows.map((match) => ({
      id: match.id,
      difficulty: match.difficulty,
      opponentHandle: match.opponent_handle,
      outcome: match.winner_id === null ? "draw" : match.winner_id === user.id ? "win" : "loss",
      completedAt: match.completed_at,
    })),
  };
  return NextResponse.json(response);
}
