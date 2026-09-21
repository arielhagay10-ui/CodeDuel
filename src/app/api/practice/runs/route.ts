import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";
import type { PracticeRun } from "@/types/api";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in is required for practice runs." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const value = body as { problemSlug?: unknown; sourceCode?: unknown } | null;
  if (!value || typeof value.problemSlug !== "string" || typeof value.sourceCode !== "string" || !value.sourceCode.trim()) {
    return NextResponse.json({ error: "Provide a problem slug and source code." }, { status: 422 });
  }
  const problem = await getDb().query<{ id: string }>(
    "SELECT id FROM problems WHERE slug = $1 AND published_at IS NOT NULL AND retired_at IS NULL",
    [value.problemSlug],
  );
  if (!problem.rowCount) return NextResponse.json({ error: "Practice problem not found." }, { status: 404 });
  const id = crypto.randomUUID();
  const db = getDb();
  await db.query("INSERT INTO practice_runs (id, user_id, problem_id, source_code) VALUES ($1, $2, $3, $4)", [id, userId, problem.rows[0].id, value.sourceCode]);
  await db.query("INSERT INTO practice_jobs (id, practice_run_id) VALUES ($1, $2)", [crypto.randomUUID(), id]);
  const response: PracticeRun = { id, verdict: "queued", testsPassed: 0, testsTotal: 0 };
  return NextResponse.json(response, { status: 202 });
}
