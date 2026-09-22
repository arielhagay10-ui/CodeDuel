"use client";
import { Suspense,useEffect } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import { AppShell,ErrorNotice } from "@/components/app-shell";
import { useMatchState } from "@/lib/hooks/use-match";
function Content(){const id=useSearchParams().get("matchId"),router=useRouter();const {data,error,refresh}=useMatchState(id);useEffect(()=>{if(data&&id)router.replace(data.status==="completed"?`/match/complete?matchId=${id}`:data.activeRound?`/match/round?matchId=${id}&roundId=${data.activeRound.id}`:`/match/lobby?matchId=${id}`);},[data,id,router]);return <AppShell><h1 className="text-3xl font-semibold">Reconnecting to your match…</h1><ErrorNotice message={error??(!id?"Missing match ID.":null)}/><button className="mt-5 underline" onClick={()=>void refresh()}>Retry now</button></AppShell>;}
export default function Reconnecting(){return <Suspense><Content/></Suspense>;}
