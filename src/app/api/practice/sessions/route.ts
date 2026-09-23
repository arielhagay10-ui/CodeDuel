import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";
import type { PracticeSession, PracticeSessionState } from "@/lib/client-contracts";

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const projection = `id,timed,started_at AS "startedAt",completed_at AS "completedAt",
  abandoned_at AS "abandonedAt",GREATEST(0,elapsed_seconds)::float8 AS "elapsedSeconds"`;
const firstSolve = `NOT EXISTS(SELECT 1 FROM practice_runs previous WHERE previous.user_id=s.user_id
  AND previous.problem_id=s.problem_id AND previous.verdict='accepted' AND previous.created_at<s.started_at)`;

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Sign in to save practice progress." }, { status: 401 });
  const problemId = new URL(request.url).searchParams.get("problemId") ?? "";
  if (!uuid.test(problemId)) return Response.json({ error: "Invalid problem." }, { status: 422 });
  const [latest, totals, recent, activeTimed, abandoned, comparisons] = await Promise.all([
    getDb().query<PracticeSession>(`SELECT ${projection} FROM practice_session_progress
      WHERE user_id=$1 AND problem_id=$2 ORDER BY started_at DESC,id DESC LIMIT 1`, [userId,problemId]),
    getDb().query<{ timedSolves: number; bestSeconds: number | null }>(`SELECT count(*)::int AS "timedSolves",
      min(GREATEST(0,elapsed_seconds))::float8 AS "bestSeconds" FROM practice_session_progress
      WHERE user_id=$1 AND problem_id=$2 AND timed AND completed_at IS NOT NULL`, [userId,problemId]),
    getDb().query<{ seconds: number; completedAt: string; firstSolve: boolean }>(`SELECT GREATEST(0,elapsed_seconds)::float8 AS seconds,
      completed_at AS "completedAt",${firstSolve} AS "firstSolve" FROM practice_session_progress s
      WHERE user_id=$1 AND problem_id=$2 AND timed AND completed_at IS NOT NULL
      ORDER BY started_at DESC,id DESC LIMIT 10`, [userId,problemId]),
    getDb().query<NonNullable<PracticeSessionState["activeTimed"]>>(`SELECT ${projection},problem_id AS "problemId",
      (SELECT title FROM problems WHERE id=s.problem_id) AS title FROM practice_session_progress s
      WHERE user_id=$1 AND timed AND completed_at IS NULL AND abandoned_at IS NULL LIMIT 1`,[userId]),
    getDb().query<{count:number}>(`SELECT count(*)::int AS count FROM practice_sessions WHERE user_id=$1 AND problem_id=$2 AND abandoned_at IS NOT NULL`,[userId,problemId]),
    getDb().query<PracticeSessionState["comparisons"][number]>(`WITH solved AS (
      SELECT p.difficulty,p.tags,GREATEST(0,s.elapsed_seconds) AS seconds,${firstSolve} AS first_solve
      FROM practice_session_progress s JOIN problems p ON p.id=s.problem_id
      WHERE s.user_id=$1 AND s.timed AND s.completed_at IS NOT NULL AND s.abandoned_at IS NULL
    ) SELECT difficulty,tag,first_solve AS "firstSolve",count(*)::int AS count,
      round(avg(seconds))::float8 AS "averageSeconds" FROM solved
      CROSS JOIN LATERAL unnest(array_prepend(NULL::text,tags)) AS topic(tag)
      GROUP BY difficulty,tag,first_solve ORDER BY difficulty,tag NULLS FIRST,first_solve DESC`,[userId]),
  ]);
  const result: PracticeSessionState = { session: latest.rows[0] ?? null, activeTimed:activeTimed.rows[0]??null,
    stats: { ...totals.rows[0], abandonedAttempts:abandoned.rows[0].count,recent: recent.rows }, comparisons:comparisons.rows };
  return Response.json(result);
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Sign in to save practice progress." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.problemId !== "string" || !uuid.test(body.problemId) || typeof body.timed !== "boolean") {
    return Response.json({ error: "Choose a problem and timed or untimed practice." }, { status: 422 });
  }
  if(body.abandonSessionId!==undefined&&(typeof body.abandonSessionId!=="string"||!uuid.test(body.abandonSessionId)))return Response.json({error:"Invalid attempt."},{status:422});
  const db = await getDb().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`practice:${userId}`]);
    const problem = await db.query("SELECT id FROM problems WHERE id=$1 AND published_at IS NOT NULL AND retired_at IS NULL", [body.problemId]);
    if (!problem.rowCount) { await db.query("ROLLBACK"); return Response.json({ error: "Problem not found." }, { status: 404 }); }
    if(body.abandonSessionId){
      const abandoned=await db.query(`UPDATE practice_sessions SET abandoned_at=clock_timestamp() WHERE id=$1 AND user_id=$2
        AND id IN(SELECT id FROM practice_session_progress WHERE completed_at IS NULL AND abandoned_at IS NULL) RETURNING id`,[body.abandonSessionId,userId]);
      if(!abandoned.rowCount){await db.query("ROLLBACK");return Response.json({error:"That attempt has already ended. Refresh to continue."},{status:409});}
    }
    if(body.timed){
      const other=await db.query(`SELECT id FROM practice_session_progress WHERE user_id=$1 AND timed
        AND completed_at IS NULL AND abandoned_at IS NULL AND problem_id<>$2`,[userId,body.problemId]);
      if(other.rowCount){await db.query("ROLLBACK");return Response.json({error:"Resume or abandon your current timed attempt before starting another."},{status:409});}
    }
    const active = await db.query<PracticeSession>(`SELECT ${projection} FROM practice_session_progress
      WHERE user_id=$1 AND problem_id=$2 AND completed_at IS NULL AND abandoned_at IS NULL ORDER BY started_at DESC LIMIT 1`, [userId,body.problemId]);
    if (active.rowCount) { await db.query("COMMIT"); return Response.json(active.rows[0]); }
    const created = await db.query<PracticeSession>(`INSERT INTO practice_sessions(id,user_id,problem_id,timed)
      VALUES($1,$2,$3,$4) RETURNING id,timed,started_at AS "startedAt",NULL AS "completedAt",NULL AS "abandonedAt",0 AS "elapsedSeconds"`,
      [crypto.randomUUID(),userId,body.problemId,body.timed]);
    await db.query("COMMIT");
    return Response.json(created.rows[0], { status: 201 });
  } catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
}

export async function PATCH(request:Request){
  const userId=await requireUserId();
  if(!userId)return Response.json({error:"Sign in is required."},{status:401});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body.sessionId!=="string"||!uuid.test(body.sessionId))return Response.json({error:"Invalid attempt."},{status:422});
  const db=await getDb().connect();
  try{
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`practice:${userId}`]);
    const found=await db.query<PracticeSession>(`SELECT ${projection} FROM practice_session_progress WHERE id=$1 AND user_id=$2`,[body.sessionId,userId]);
    if(!found.rowCount){await db.query("ROLLBACK");return Response.json({error:"Attempt not found."},{status:404});}
    if(found.rows[0].completedAt){await db.query("ROLLBACK");return Response.json({error:"This attempt is already complete."},{status:409});}
    await db.query("UPDATE practice_sessions SET abandoned_at=COALESCE(abandoned_at,clock_timestamp()) WHERE id=$1 AND user_id=$2",[body.sessionId,userId]);
    await db.query("COMMIT");return new Response(null,{status:204});
  }catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
}
