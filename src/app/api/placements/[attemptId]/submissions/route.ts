import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

export async function POST(request: Request, context: RouteContext<"/api/placements/[attemptId]/submissions">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { attemptId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const sourceCode = typeof body === "object" && body && "sourceCode" in body ? (body as { sourceCode?: unknown }).sourceCode : null;
  if (typeof sourceCode !== "string" || sourceCode.length > 100_000) return NextResponse.json({ error: "Invalid source code." }, { status: 422 });
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const attempt = await client.query<{ problem_id: string }>("SELECT problem_id FROM placement_attempts WHERE id = $1 AND user_id = $2 AND status = 'active' AND ends_at > now() FOR UPDATE", [attemptId, userId]);
    if (!attempt.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Placement attempt is unavailable." }, { status: 409 }); }
    const submissionId = crypto.randomUUID();
    await client.query("INSERT INTO submissions (id, user_id, problem_id, placement_attempt_id, source_code) VALUES ($1, $2, $3, $4, $5)", [submissionId, userId, attempt.rows[0].problem_id, attemptId, sourceCode]);
    await client.query("INSERT INTO judge_jobs (id, submission_id) VALUES ($1, $2)", [crypto.randomUUID(), submissionId]);
    await client.query("COMMIT");
    return NextResponse.json({ submissionId, locked: true }, { status: 202 });
  } catch (caught) { await client.query("ROLLBACK"); throw caught; } finally { client.release(); }
}
