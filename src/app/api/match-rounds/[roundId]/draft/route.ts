import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireRankedUser } from "@/lib/ranked-access";

const maxSourceLength = 100_000;

export async function GET(_request: Request, context: RouteContext<"/api/match-rounds/[roundId]/draft">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { roundId } = await context.params;
  const draft = await getDb().query<{ source_code: string | null; updated_at: string | null }>(
    [
      "SELECT d.source_code, d.updated_at",
      "FROM match_rounds r JOIN matches m ON m.id = r.match_id",
      "LEFT JOIN round_drafts d ON d.match_round_id = r.id AND d.user_id = $2",
      "WHERE r.id = $1 AND r.status = 'active' AND $2 IN (m.player_one_id, m.player_two_id)",
    ].join(" "),
    [roundId, userId],
  );
  if (!draft.rowCount) return NextResponse.json({ error: "This active round is unavailable." }, { status: 404 });
  const value = draft.rows[0];
  return NextResponse.json({
    sourceCode: value.source_code,
    updatedAt: value.updated_at,
  });
}

export async function PUT(request: Request, context: RouteContext<"/api/match-rounds/[roundId]/draft">) {
  const { userId, error } = await requireRankedUser();
  if (error) return error;
  const { roundId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const sourceCode = typeof body === "object" && body && "sourceCode" in body ? (body as { sourceCode?: unknown }).sourceCode : null;
  if (typeof sourceCode !== "string" || sourceCode.length > maxSourceLength) {
    return NextResponse.json({ error: "Source code must be at most 100,000 characters." }, { status: 422 });
  }

  const ownership = await getDb().query(
    "SELECT r.id FROM match_rounds r JOIN matches m ON m.id = r.match_id WHERE r.id = $1 AND r.status = 'active' AND r.ends_at > now() AND $2 IN (m.player_one_id, m.player_two_id)",
    [roundId, userId],
  );
  if (!ownership.rowCount) return NextResponse.json({ error: "This active round is unavailable." }, { status: 404 });

  await getDb().query(
    "INSERT INTO round_drafts (match_round_id, user_id, source_code) VALUES ($1, $2, $3) ON CONFLICT (match_round_id, user_id) DO UPDATE SET source_code = EXCLUDED.source_code, updated_at = now()",
    [roundId, userId, sourceCode],
  );
  return new NextResponse(null, { status: 204 });
}
