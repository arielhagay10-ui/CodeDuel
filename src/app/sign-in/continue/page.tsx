import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/access";
import { getDb } from "@/lib/db";
export default async function ContinueSignIn() {
  const id = await requireUserId();
  if (!id) redirect("/sign-in");
  const result = await getDb().query<{ handle: string | null; ready: boolean; banned: boolean }>(`SELECT handle,
    (fair_play_accepted_at IS NOT NULL AND ranked_access_granted_at IS NOT NULL) AS ready,
    banned_at IS NOT NULL AS banned FROM users WHERE id=$1`, [id]);
  const user = result.rows[0];
  if (!user || user.banned) redirect("/sign-in?error=AccessDenied");
  redirect(!user.handle ? "/onboarding/handle" : !user.ready ? "/onboarding/fair-play" : "/queue");
}
