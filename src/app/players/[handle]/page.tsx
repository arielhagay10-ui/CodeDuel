"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback } from "react";
import { AppShell,ErrorNotice } from "@/components/app-shell";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/hooks/use-resource";
import { avatarColorForHandle,initialsForHandle } from "@/lib/avatar";
import { difficultyLabel,rankLabel } from "@/lib/match-view";
export default function Profile(){const {handle}=useParams<{handle:string}>();const load=useCallback(async()=>({profile:await api.getProfile(handle),account:await api.getMe()}),[handle]);const {data,error}=useResource(handle,load);
  return <AppShell><ErrorNotice message={error}/>{!data&&!error&&<p>Loading player…</p>}{data&&<><div className="flex items-center gap-5"><span style={{background:avatarColorForHandle(data.profile.handle)}} className="grid h-16 w-16 place-items-center rounded-full text-xl font-bold text-white">{initialsForHandle(data.profile.handle)}</span><h1 className="text-4xl font-bold">@{data.profile.handle}</h1></div><div className="my-8 grid gap-4 sm:grid-cols-3">{data.profile.ranks.map(r=><section key={r.difficulty} className="rounded-xl bg-white p-6"><h2>{difficultyLabel(r.difficulty)}</h2><p className="mt-3 font-bold">{rankLabel(r.rank)}</p></section>)}</div><h2 className="mb-4 text-2xl font-semibold">Recent matches</h2>{!data.profile.recentMatches.length&&<p>No completed matches yet.</p>}<ul className="divide-y rounded-xl bg-white">{data.profile.recentMatches.map(m=><li key={m.id} className="flex flex-wrap items-center gap-4 p-5"><span>{difficultyLabel(m.difficulty)} · {m.outcome}</span><Link className="underline" href={`/players/${encodeURIComponent(m.opponentHandle)}`}>vs @{m.opponentHandle}</Link><time className="text-sm text-black/55">{new Date(m.completedAt).toLocaleDateString()}</time>{data.account.user?.handle===m.opponentHandle&&<Link className="ml-auto underline" href={`/match/report?matchId=${m.id}`}>Report player</Link>}</li>)}</ul></>}</AppShell>;
}
