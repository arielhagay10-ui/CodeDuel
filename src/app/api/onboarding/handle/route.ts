import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";

const handlePattern = /^[A-Za-z0-9](?:[A-Za-z0-9_]{1,22}[A-Za-z0-9])?$/;
const reservedHandles = new Set(["admin", "codewars", "moderator", "support", "system"]);

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const handle = typeof body === "object" && body && "handle" in body ? (body as { handle?: unknown }).handle : null;
  if (typeof handle !== "string" || !handlePattern.test(handle) || reservedHandles.has(handle.toLowerCase())) {
    return NextResponse.json({ error: "Choose a valid, available handle." }, { status: 422 });
  }

  try {
    const result = await getDb().query<{ handle: string }>(
      "UPDATE users SET handle = $1 WHERE id = $2 AND handle IS NULL RETURNING handle",
      [handle, userId],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Your handle has already been claimed." }, { status: 409 });
    return NextResponse.json({ handle: result.rows[0].handle });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "That handle is already taken." }, { status: 409 });
    }
    throw error;
  }
}
