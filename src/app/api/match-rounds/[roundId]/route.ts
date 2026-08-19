import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

export async function GET(_request: Request, context: RouteContext<"/api/match-rounds/[roundId]">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { roundId } = await context.params;
  const round = await getDb().query<{
    status: string; ends_at: string; player_one_id: string; player_two_id: string; winner_id: string | null;
    player_one_tests_passed: number; player_two_tests_passed: number; player_one_submission: boolean; player_two_submission: boolean;
  }>(`
    SELECT r.status, r.ends_at, r.winner_id, r.player_one_tests_passed, r.player_two_tests_passed, m.player_one_id, m.player_two_id,
      EXISTS(SELECT 1 FROM submissions s WHERE s.match_round_id = r.id AND s.user_id = m.player_one_id) AS player_one_submission,
      EXISTS(SELECT 1 FROM submissions s WHERE s.match_round_id = r.id AND s.user_id = m.player_two_id) AS player_two_submission
    FROM match_rounds r JOIN matches m ON m.id = r.match_id
    WHERE r.id = $1 AND $2 IN (m.player_one_id, m.player_two_id)
  `, [roundId, userId]);
  if (!round.rowCount) return NextResponse.json({ error: "Round not found." }, { status: 404 });
  const value = round.rows[0];
  const bothSubmitted = value.player_one_submission && value.player_two_submission;
  const revealed = bothSubmitted && (value.status === "completed" || value.status === "draw");
  return NextResponse.json({
    status: value.status, endsAt: value.ends_at, youSubmitted: userId === value.player_one_id ? value.player_one_submission : value.player_two_submission,
    opponentSubmitted: userId === value.player_one_id ? value.player_two_submission : value.player_one_submission,
    revealed,
    ...(revealed ? { winnerId: value.winner_id, yourTestsPassed: userId === value.player_one_id ? value.player_one_tests_passed : value.player_two_tests_passed, opponentTestsPassed: userId === value.player_one_id ? value.player_two_tests_passed : value.player_one_tests_passed } : {}),
  });
}
