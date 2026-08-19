import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";

export async function requireRankedUser() {
  const userId = await requireUserId();
  if (!userId) return { userId: null, error: NextResponse.json({ error: "Sign in is required." }, { status: 401 }) };

  const user = await getDb().query<{ id: string }>(
    "SELECT id FROM users WHERE id = $1 AND handle IS NOT NULL AND ranked_access_granted_at IS NOT NULL AND banned_at IS NULL",
    [userId],
  );
  if (!user.rowCount) return { userId: null, error: NextResponse.json({ error: "Ranked access is required." }, { status: 403 }) };
  return { userId, error: null };
}
