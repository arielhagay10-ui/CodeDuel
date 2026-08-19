import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

const maxSourceLength = 100_000;

export async function POST(request: Request, context: RouteContext<"/api/match-rounds/[roundId]/submissions">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { roundId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const sourceCode = typeof body === "object" && body && "sourceCode" in body ? (body as { sourceCode?: unknown }).sourceCode : null;
  if (typeof sourceCode !== "string" || sourceCode.length > maxSourceLength) {
    return NextResponse.json({ error: "Source code must be at most 100,000 characters." }, { status: 422 });
  }

  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const round = await client.query<{ problem_id: string }>(
      "SELECT r.problem_id FROM match_rounds r JOIN matches m ON m.id = r.match_id WHERE r.id = $1 AND r.status = 'active' AND r.ends_at > now() AND $2 IN (m.player_one_id, m.player_two_id) FOR UPDATE OF r",
      [roundId, userId],
    );
    if (!round.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This active round is unavailable." }, { status: 404 });
    }
    const existing = await client.query("SELECT id FROM submissions WHERE match_round_id = $1 AND user_id = $2", [roundId, userId]);
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Your solution is already locked." }, { status: 409 });
    }
    const submissionId = crypto.randomUUID();
    await client.query(
      "INSERT INTO submissions (id, user_id, problem_id, match_round_id, source_code) VALUES ($1, $2, $3, $4, $5)",
      [submissionId, userId, round.rows[0].problem_id, roundId, sourceCode],
    );
    await client.query("INSERT INTO judge_jobs (id, submission_id) VALUES ($1, $2)", [crypto.randomUUID(), submissionId]);
    await client.query("INSERT INTO round_drafts (match_round_id, user_id, source_code) VALUES ($1, $2, $3) ON CONFLICT (match_round_id, user_id) DO UPDATE SET source_code = EXCLUDED.source_code, updated_at = now()", [roundId, userId, sourceCode]);
    await client.query("COMMIT");
    return NextResponse.json({ submissionId, locked: true }, { status: 202 });
  } catch (caught) {
    await client.query("ROLLBACK");
    throw caught;
  } finally {
    client.release();
  }
}
