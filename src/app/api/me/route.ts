import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";
import type { AccountState } from "@/lib/client-contracts";
export async function GET() {
  const id = await requireUserId();
  if (!id) return Response.json({ user: null });
  const result = await getDb().query<NonNullable<AccountState["user"]>>(`SELECT id,handle,
    (ranked_access_granted_at IS NOT NULL AND fair_play_accepted_at IS NOT NULL) AS "rankedAccess",
    (banned_at IS NOT NULL) AS banned FROM users WHERE id=$1`, [id]);
  return Response.json({ user: result.rows[0] ?? null });
}
