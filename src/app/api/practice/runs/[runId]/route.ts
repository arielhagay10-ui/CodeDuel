import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";
import type { PracticeRun } from "@/types/api";
export async function GET(_request: Request, context: RouteContext<"/api/practice/runs/[runId]">) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { runId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) return Response.json({ error: "Run not found." }, { status: 404 });
  const run = await getDb().query<PracticeRun>(`SELECT id,verdict,tests_passed AS "testsPassed",
    tests_total AS "testsTotal" FROM practice_runs WHERE id=$1 AND user_id=$2`, [runId,userId]);
  return run.rowCount ? Response.json(run.rows[0]) : Response.json({ error: "Run not found." }, { status: 404 });
}
