"use client";
import Link from "next/link";
import { Suspense,useState } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import { AppShell,buttonClass,ErrorNotice } from "@/components/app-shell";
import { api } from "@/lib/api-client";
import { useMatchState } from "@/lib/hooks/use-match";
function Content(){const id=useSearchParams().get("matchId"),router=useRouter();const {data,error}=useMatchState(id);const [busy,setBusy]=useState(false),[notice,setNotice]=useState<string|null>(null);
  async function surrender(){if(!id||busy)return;setBusy(true);try{await api.surrender(id);router.replace(`/match/complete?matchId=${id}`);}catch(e){setNotice(e instanceof Error?e.message:"Unable to surrender.");setBusy(false);}}
  const back=data?.activeRound?`/match/round?matchId=${id}&roundId=${data.activeRound.id}`:`/match/lobby?matchId=${id}`;
  return <AppShell><section className="mx-auto max-w-lg rounded-xl bg-white p-8"><h1 className="text-3xl font-semibold">Surrender this match?</h1><p className="my-5">This ends the match against {data?`@${data.opponent.handle}`:"your opponent"} immediately and counts as a loss.</p><ErrorNotice message={notice??error??(!id?"Missing match ID.":null)}/><Link href={id?back:"/queue"} className="mr-5 underline">Keep playing</Link><button className={buttonClass} disabled={!data||busy||data.status==="completed"||data.status==="cancelled"} onClick={()=>void surrender()}>Confirm surrender</button></section></AppShell>;}
export default function Surrender(){return <Suspense><Content/></Suspense>;}
