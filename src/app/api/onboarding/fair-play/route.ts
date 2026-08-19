import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: string }>(
      "UPDATE users SET ranked_access_granted_at = COALESCE(ranked_access_granted_at, now()), fair_play_accepted_at = COALESCE(fair_play_accepted_at, now()) WHERE id = $1 AND handle IS NOT NULL RETURNING id",
      [userId],
    );
    if (!user.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Claim a handle before accepting fair play." }, { status: 409 });
    }
    await client.query(
      "INSERT INTO user_difficulty_ratings (user_id, difficulty) VALUES ($1, 'easy'), ($1, 'medium'), ($1, 'advanced') ON CONFLICT DO NOTHING",
      [userId],
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
