import "server-only";
import { getDb } from "@/lib/db";
import type { RoundProblem } from "@/types/api";

// Explicit public projection. Never load answer keys into a client-bound object.
export async function publicProblems(id?: string): Promise<RoundProblem[]> {
  const result = await getDb().query<RoundProblem>(`
    SELECT p.id, p.slug, p.title, p.difficulty, p.format, p.entrypoint,
      p.statement_markdown AS "statementMarkdown", p.starter_code AS "starterCode",
      p.time_limit_ms AS "timeLimitMs", p.memory_limit_mb AS "memoryLimitMb",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('ordinal',t.ordinal,'inputData',t.input_data,
        'expectedOutput',t.expected_output) ORDER BY t.ordinal)
        FROM problem_tests t WHERE t.problem_id=p.id AND t.is_public=true),'[]'::jsonb) AS "publicTests"
    FROM problems p WHERE p.published_at IS NOT NULL AND p.retired_at IS NULL
      AND ($1::uuid IS NULL OR p.id=$1) ORDER BY p.difficulty,p.title LIMIT 100`, [id ?? null]);
  return result.rows;
}
