import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

export async function GET(_request: Request, context: RouteContext<"/api/match-rounds/[roundId]">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { roundId } = await context.params;
  const round = await getDb().query<{
    id: string; round_number: number; status: "pending" | "active" | "completed" | "draw"; ends_at: string | null;
    player_one_id: string; player_two_id: string; winner_id: string | null; player_one_tests_passed: number; player_two_tests_passed: number;
    player_one_submission: boolean; player_two_submission: boolean;
    player_one_verdict: "queued" | "running" | "accepted" | "wrong_answer" | "time_limit_exceeded" | "runtime_error" | "internal_error" | null;
    player_two_verdict: "queued" | "running" | "accepted" | "wrong_answer" | "time_limit_exceeded" | "runtime_error" | "internal_error" | null;
    tests_total: number; problem_id: string; slug: string; title: string; difficulty: "easy" | "medium" | "advanced";
    format: "function" | "standard_input_output"; entrypoint: string | null; statement_markdown: string; starter_code: string;
    time_limit_ms: number; memory_limit_mb: number; server_time: string;
  }>([
    "SELECT r.id, r.round_number, r.status, r.ends_at, r.winner_id, r.player_one_tests_passed, r.player_two_tests_passed,",
    "m.player_one_id, m.player_two_id, p.id AS problem_id, p.slug, p.title, p.difficulty, p.format, p.entrypoint,",
    "p.statement_markdown, p.starter_code, p.time_limit_ms, p.memory_limit_mb, now() AS server_time,",
    "EXISTS(SELECT 1 FROM submissions s WHERE s.match_round_id = r.id AND s.user_id = m.player_one_id) AS player_one_submission,",
    "EXISTS(SELECT 1 FROM submissions s WHERE s.match_round_id = r.id AND s.user_id = m.player_two_id) AS player_two_submission,",
    "(SELECT verdict FROM submissions s WHERE s.match_round_id = r.id AND s.user_id = m.player_one_id LIMIT 1) AS player_one_verdict,",
    "(SELECT verdict FROM submissions s WHERE s.match_round_id = r.id AND s.user_id = m.player_two_id LIMIT 1) AS player_two_verdict,",
    "COALESCE((SELECT tests_total FROM submissions s WHERE s.match_round_id = r.id AND s.user_id = m.player_one_id LIMIT 1), 0)::int AS tests_total",
    "FROM match_rounds r JOIN matches m ON m.id = r.match_id JOIN problems p ON p.id = r.problem_id",
    "WHERE r.id = $1 AND $2 IN (m.player_one_id, m.player_two_id)",
  ].join(" "), [roundId, userId]);
  if (!round.rowCount) return NextResponse.json({ error: "Round not found." }, { status: 404 });
  const value = round.rows[0];
  const bothSubmitted = value.player_one_submission && value.player_two_submission;
  const revealed = bothSubmitted && (value.status === "completed" || value.status === "draw");
  const problemVisible = value.status !== "pending";
  const publicTests = problemVisible
    ? (await getDb().query<{ ordinal: number; input_data: string; expected_output: string }>(
        "SELECT ordinal, input_data, expected_output FROM problem_tests WHERE problem_id = $1 AND is_public = true ORDER BY ordinal",
        [value.problem_id],
      )).rows
    : [];
  const yourTestsPassed = userId === value.player_one_id ? value.player_one_tests_passed : value.player_two_tests_passed;
  const opponentTestsPassed = userId === value.player_one_id ? value.player_two_tests_passed : value.player_one_tests_passed;
  const yourVerdict = userId === value.player_one_id ? value.player_one_verdict : value.player_two_verdict;
  const opponentVerdict = userId === value.player_one_id ? value.player_two_verdict : value.player_one_verdict;
  return NextResponse.json({
    id: value.id,
    roundNumber: value.round_number,
    status: value.status,
    endsAt: value.ends_at,
    problem: !problemVisible ? null : {
      id: value.problem_id, slug: value.slug, title: value.title, difficulty: value.difficulty, format: value.format,
      entrypoint: value.entrypoint, statementMarkdown: value.statement_markdown, starterCode: value.starter_code,
      timeLimitMs: value.time_limit_ms, memoryLimitMb: value.memory_limit_mb,
      publicTests: publicTests.map((test) => ({ ordinal: test.ordinal, inputData: test.input_data, expectedOutput: test.expected_output })),
    },
    youSubmitted: userId === value.player_one_id ? value.player_one_submission : value.player_two_submission,
    opponentSubmitted: userId === value.player_one_id ? value.player_two_submission : value.player_one_submission,
    revealed,
    result: !revealed ? null : {
      outcome: value.winner_id === null ? "draw" : value.winner_id === userId ? "win" : "loss",
      yourTestsPassed, opponentTestsPassed, testsTotal: value.tests_total,
      yourVerdict: yourVerdict!, opponentVerdict: opponentVerdict!,
    },
    serverTime: value.server_time,
  });
}
