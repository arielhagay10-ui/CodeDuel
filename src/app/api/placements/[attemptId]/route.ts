import { requireRankedUser } from "@/lib/ranked-access";
import { getDb } from "@/lib/db";
import { publicProblems } from "@/lib/public-problems";
import type { PlacementAttempt } from "@/lib/client-contracts";
export async function GET(_request: Request, context: RouteContext<"/api/placements/[attemptId]">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { attemptId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) return Response.json({ error: "Placement not found." }, { status: 404 });
  const result = await getDb().query<PlacementAttempt & { problemId: string }>(`SELECT a.id,a.difficulty,
    a.placement_number AS "placementNumber",a.status,a.ends_at AS "endsAt",now() AS "serverTime",
    a.problem_id AS "problemId",EXISTS(SELECT 1 FROM submissions s WHERE s.placement_attempt_id=a.id) AS submitted,
    CASE WHEN a.status='completed' THEN jsonb_build_object('testsPassed',a.tests_passed,'testsTotal',a.tests_total) ELSE NULL END AS result
    FROM placement_attempts a WHERE a.id=$1 AND a.user_id=$2`, [attemptId,userId]);
  const attempt = result.rows[0];
  if (!attempt) return Response.json({ error: "Placement not found." }, { status: 404 });
  const [problem] = await publicProblems(attempt.problemId);
  if (!problem) return Response.json({ error: "Problem unavailable." }, { status: 404 });
  return Response.json({ id:attempt.id,difficulty:attempt.difficulty,placementNumber:attempt.placementNumber,
    status:attempt.status,endsAt:attempt.endsAt,serverTime:attempt.serverTime,submitted:attempt.submitted,result:attempt.result,problem });
}
