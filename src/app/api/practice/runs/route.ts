import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";
import type { PracticeRun } from "@/types/api";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in is required for practice runs." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const value = body as { problemSlug?: unknown; sourceCode?: unknown; sessionId?: unknown } | null;
  if (!value || typeof value.problemSlug !== "string" || typeof value.sourceCode !== "string" || !value.sourceCode.trim() || value.sourceCode.length > 100_000) {
    return NextResponse.json({ error: "Provide a problem slug and source code." }, { status: 422 });
  }
  if (value.sessionId !== undefined && (typeof value.sessionId !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.sessionId))) {
    return NextResponse.json({ error: "Invalid practice attempt." }, { status: 422 });
  }
  const problem = await getDb().query<{ id: string }>(
    "SELECT id FROM problems WHERE slug = $1 AND published_at IS NOT NULL AND retired_at IS NULL",
    [value.problemSlug],
  );
  if (!problem.rowCount) return NextResponse.json({ error: "Practice problem not found." }, { status: 404 });
  const id = crypto.randomUUID();
  const db = await getDb().connect();
  try {
    await db.query("BEGIN");
    if (value.sessionId) {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`practice:${userId}`]);
      const session = await db.query("SELECT id FROM practice_session_progress WHERE id=$1 AND user_id=$2 AND problem_id=$3 AND completed_at IS NULL AND abandoned_at IS NULL", [value.sessionId,userId,problem.rows[0].id]);
      if (!session.rowCount) { await db.query("ROLLBACK"); return NextResponse.json({ error: "Practice attempt is complete or unavailable." }, { status: 409 }); }
    }
    await db.query("INSERT INTO practice_runs (id, user_id, problem_id, source_code, session_id) VALUES ($1, $2, $3, $4, $5)", [id, userId, problem.rows[0].id, value.sourceCode, value.sessionId ?? null]);
    await db.query("INSERT INTO practice_jobs (id, practice_run_id) VALUES ($1, $2)", [crypto.randomUUID(), id]);
    await db.query("COMMIT");
  } catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
  const response: PracticeRun = { id, verdict: "queued", testsPassed: 0, testsTotal: 0 };
  return NextResponse.json(response, { status: 202 });
}
