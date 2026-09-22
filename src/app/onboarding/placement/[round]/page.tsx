"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback,useEffect,useState } from "react";
import { AppShell,buttonClass,ErrorNotice } from "@/components/app-shell";
import { ProblemPanel } from "@/components/problem-panel";
import { CodeEditor } from "@/components/code-editor";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/hooks/use-resource";
import { useServerClock } from "@/lib/hooks/use-server-clock";
import { formatClock } from "@/lib/match-view";
import type { PlacementAttempt } from "@/lib/client-contracts";
export default function PlacementRound(){
  const {round:id}=useParams<{round:string}>();const load=useCallback(()=>api.getPlacement(id),[id]);
  const {data,error,refresh}=useResource(id,load,2000);
  return <AppShell><ErrorNotice message={error}/>{data?<Attempt key={id} attempt={data} refresh={refresh}/>:!error&&<p>Loading placement…</p>}</AppShell>;
}
function Attempt({attempt,refresh}:{attempt:PlacementAttempt;refresh:()=>void}){
  const key=`codeduel.placement.${attempt.id}`;
  const [code,setCode]=useState(()=>{try{return localStorage.getItem(key)??attempt.problem.starterCode;}catch{return attempt.problem.starterCode;}});
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState<string|null>(null),[locked,setLocked]=useState(false);
  const [,tick]=useState(0);const {sync,secondsUntil}=useServerClock();
  useEffect(()=>{sync(attempt.serverTime);},[attempt.serverTime,sync]);
  useEffect(()=>{const timer=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(timer);},[]);
  const expired=secondsUntil(attempt.endsAt)===0;
  async function submit(){if(busy)return;setBusy(true);setNotice(null);try{await api.submitPlacement(attempt.id,code);setLocked(true);refresh();}catch(e){setNotice(e instanceof Error?e.message:"Submission failed.");refresh();}finally{setBusy(false);}}
  if(attempt.status!=="active")return <section className="mx-auto max-w-xl rounded-xl bg-white p-8"><h1 className="text-3xl font-bold">Placement {attempt.placementNumber} complete</h1><p className="my-5">{attempt.result?`${attempt.result.testsPassed}/${attempt.result.testsTotal} tests passed.`:"This attempt has ended."}</p><Link href="/onboarding/placement" className={buttonClass}>Continue placements</Link><Link href="/onboarding/placement/results" className="ml-4 underline">View ranks</Link></section>;
  return <><div className="mb-5 flex justify-between"><h1 className="text-2xl font-bold">Placement {attempt.placementNumber} of 5</h1><span className="font-mono text-xl">{formatClock(secondsUntil(attempt.endsAt))}</span></div><div className="grid gap-6 lg:grid-cols-2"><ProblemPanel problem={attempt.problem}/><section className="rounded-xl bg-[#171717] p-6 text-white"><CodeEditor label="Placement code editor" value={code} disabled={attempt.submitted||locked||expired||busy} onChange={value=>{setCode(value);try{localStorage.setItem(key,value);}catch{setNotice("Local storage unavailable; keep this tab open.");}}}/><p className="my-4 text-sm text-white/65">Your draft stays on this device. Submit before time expires; the server uses starter code for an unsubmitted attempt.</p><ErrorNotice message={notice}/>{attempt.submitted||locked||expired?<p role="status">Waiting for the judge…</p>:<button className={buttonClass} onClick={()=>void submit()} disabled={busy}>{busy?"Submitting…":"Submit placement"}</button>}</section></div></>;
}
