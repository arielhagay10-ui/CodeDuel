import { getDb } from "@/lib/db";
import { CATALOG_PAGE_SIZE, parseCatalogSearch, problemSummary } from "@/lib/problem-catalog";
import type { Difficulty } from "@/types/api";

type CatalogRow = { id: string; title: string; difficulty: Difficulty; statement_markdown: string; tags: string[] };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const search = (params.get("q") ?? "").trim();
  const difficulty = params.get("difficulty") ?? "all";
  const rawPage = params.get("page") ?? "1";
  if (search.length > 80 || !["all", "easy", "medium", "advanced"].includes(difficulty)
    || !/^[1-9]\d{0,5}$/.test(rawPage)) {
    return Response.json({ error: "Invalid catalog filters." }, { status: 422 });
  }
  const page = Number(rawPage);
  const { text, tags } = parseCatalogSearch(search);
  const filters = [difficulty === "all" ? null : difficulty, text ? `%${text.replace(/[\\%_]/g, "\\$&")}%` : null, tags];
  const where = `published_at IS NOT NULL AND retired_at IS NULL
    AND ($1::text IS NULL OR difficulty::text=$1)
    AND ($2::text IS NULL OR title ILIKE $2 ESCAPE '\\' OR slug ILIKE $2 ESCAPE '\\'
      OR entrypoint ILIKE $2 ESCAPE '\\' OR statement_markdown ILIKE $2 ESCAPE '\\'
      OR array_to_string(tags,' ') ILIKE $2 ESCAPE '\\') AND tags @> $3::text[]`;
  const [count, rows, topics] = await Promise.all([
    getDb().query<{ total: string }>(`SELECT count(*) AS total FROM problems WHERE ${where}`, filters),
    getDb().query<CatalogRow>(`SELECT id,title,difficulty,statement_markdown,tags FROM problems
      WHERE ${where} ORDER BY difficulty,title,id LIMIT $4 OFFSET $5`, [...filters, CATALOG_PAGE_SIZE, (page - 1) * CATALOG_PAGE_SIZE]),
    getDb().query<{ tag: string }>(`SELECT DISTINCT unnest(tags) AS tag FROM problems
      WHERE published_at IS NOT NULL AND retired_at IS NULL ORDER BY tag`),
  ]);
  return Response.json({
    problems: rows.rows.map(row => ({ id: row.id, title: row.title, difficulty: row.difficulty, summary: problemSummary(row.statement_markdown), tags: row.tags })),
    availableTags: topics.rows.map(row => row.tag),
    total: Number(count.rows[0].total), page, pageSize: CATALOG_PAGE_SIZE,
  });
}
