"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell,buttonClass,ErrorNotice } from "@/components/app-shell";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/hooks/use-resource";
import { difficultyLabel,rankLabel } from "@/lib/match-view";
import type { Difficulty } from "@/types/api";
export default function Placements(){
  const {data,error}=useResource("placements",api.getPlacements,4000),router=useRouter();
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState<string|null>(null);
  async function start(difficulty:Difficulty){setBusy(true);setNotice(null);try{const result=await api.startPlacement(difficulty);router.push(`/onboarding/placement/${result.attempt.id}`);}catch(e){setNotice(e instanceof Error?e.message:"Unable to start.");setBusy(false);}}
  return <AppShell><h1 className="text-4xl font-semibold">Find your starting rank.</h1><p className="my-4 text-black/60">Complete five timed placements in each difficulty you want to play.</p><ErrorNotice message={error??notice}/>
    {!data&&!error&&<p>Loading placements…</p>}{data?.attempt&&<Link className="my-5 block underline" href={`/onboarding/placement/${data.attempt.id}`}>Resume {difficultyLabel(data.attempt.difficulty)} placement {data.attempt.placementNumber}</Link>}
    <div className="mt-8 grid gap-5 md:grid-cols-3">{data?.progress.map(p=><section key={p.difficulty} className="rounded-xl border bg-white p-6"><h2 className="text-xl font-bold">{difficultyLabel(p.difficulty)}</h2><p className="my-3">{p.placementsCompleted}/5 completed</p><p className="my-3 text-black/60">{rankLabel(p.rank)}</p>{p.placementsCompleted<5?<button className={buttonClass} disabled={busy} onClick={()=>void start(p.difficulty)}>Start or resume</button>:<Link href="/queue" className={buttonClass}>Play ranked</Link>}</section>)}</div>
    <Link className="mt-8 block underline" href="/onboarding/placement/results">View placement results</Link>
  </AppShell>;
}
