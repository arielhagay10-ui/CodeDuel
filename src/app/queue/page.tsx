"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell,buttonClass,ErrorNotice } from "@/components/app-shell";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/hooks/use-resource";
import { difficultyLabel,rankLabel } from "@/lib/match-view";
import type { Difficulty } from "@/types/api";
export default function Queue(){
  const router=useRouter();const {data:queue,error,refresh}=useResource("queue",api.getQueue,3000);
  const {data:ratings}=useResource("ratings",api.getRatings);
  const [difficulty,setDifficulty]=useState<Difficulty>("medium"),[busy,setBusy]=useState(false),[notice,setNotice]=useState<string|null>(null);
  const selected=ratings?.ratings.find(r=>r.difficulty===difficulty);
  useEffect(()=>{if(queue?.matchId)router.replace(`/match/lobby?matchId=${queue.matchId}`);},[queue?.matchId,router]);
  async function join(){if(busy)return;setBusy(true);setNotice(null);try{const next=await api.joinQueue(difficulty);if(next.matchId)router.push(`/match/lobby?matchId=${next.matchId}`);else refresh();}catch(e){setNotice(e instanceof Error?e.message:"Unable to join.");}finally{setBusy(false);}}
  async function leave(){setBusy(true);try{await api.leaveQueue();refresh();}catch(e){setNotice(e instanceof Error?e.message:"Unable to leave.");}finally{setBusy(false);}}
  return <AppShell><h1 className="text-4xl font-semibold">Choose your arena.</h1><p className="my-4 text-black/60">Complete placements, then match with an opponent in the same difficulty.</p><ErrorNotice message={notice??error}/>
    <div className="my-7 grid gap-4 sm:grid-cols-3">{(["easy","medium","advanced"] as Difficulty[]).map(d=><button key={d} disabled={busy||queue?.status==="queued"} onClick={()=>setDifficulty(d)} className={`rounded-xl border p-6 text-left ${d===difficulty?"bg-[#ed5b39] text-white":"bg-white"}`}><span className="block text-xl font-bold">{difficultyLabel(d)}</span><span className="text-sm">{d==="advanced"?"One round · 20 minutes":`Up to 3 rounds · ${d==="easy"?5:10} minutes each`}</span></button>)}</div>
    {queue?.status==="queued"?<section role="status" className="rounded-xl bg-white p-8"><h2 className="text-2xl font-bold">Finding your opponent…</h2><p className="my-4">Searching the {queue.difficulty??difficulty} queue.</p><button disabled={busy} onClick={()=>void leave()} className={buttonClass}>Leave queue</button></section>:<section className="rounded-xl bg-white p-8"><h2 className="text-2xl font-bold">{selected?rankLabel(selected.rank):"Ranked play"}</h2>{selected&&selected.placementsCompleted<5&&process.env.NEXT_PUBLIC_MOCK_API!=="1"?<><p className="my-4">{selected.placementsCompleted}/5 placements completed.</p><Link className={buttonClass} href="/onboarding/placement">Complete placements</Link></>:<button className={buttonClass+" mt-5"} disabled={busy||!queue||!!error} onClick={()=>void join()}>{busy?"Joining…":"Find an opponent"}</button>}</section>}
  </AppShell>;
}
