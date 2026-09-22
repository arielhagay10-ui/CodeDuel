"use client";
import Link from "next/link";
import { Suspense,useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell,buttonClass,ErrorNotice } from "@/components/app-shell";
import { api } from "@/lib/api-client";
import { useMatchState } from "@/lib/hooks/use-match";
function Content(){const id=useSearchParams().get("matchId");const {data,error}=useMatchState(id);const [reason,setReason]=useState("suspected_cheating"),[details,setDetails]=useState(""),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[notice,setNotice]=useState<string|null>(null);
  async function send(event:React.FormEvent){event.preventDefault();if(!id||busy)return;setBusy(true);try{await api.report(id,reason,details);setDone(true);}catch(e){setNotice(e instanceof Error?e.message:"Report failed.");}finally{setBusy(false);}}
  return <AppShell><section className="mx-auto max-w-lg rounded-xl bg-white p-8"><h1 className="text-3xl font-semibold">{done?"Report submitted":`Report ${data?"@"+data.opponent.handle:"player"}`}</h1><ErrorNotice message={notice??error??(!id?"Missing match ID.":null)}/>{done?<p role="status" className="my-5">Your report was saved for private review.</p>:<form onSubmit={send}><label className="my-5 block">Reason<select value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 block w-full rounded border p-3">{["suspected_cheating","inappropriate_handle","abusive_behavior","other"].map(r=><option key={r} value={r}>{r.replaceAll("_"," ")}</option>)}</select></label><label className="block">Details (optional)<textarea maxLength={1000} value={details} onChange={e=>setDetails(e.target.value)} className="my-3 min-h-28 w-full rounded border p-3"/></label><button className={buttonClass} disabled={busy||!data||data.status!=="completed"}>Submit report</button>{data&&data.status!=="completed"&&<p className="mt-3">Reports become available after the match ends.</p>}</form>}<Link href={id?`/match/complete?matchId=${id}`:"/queue"} className="mt-5 block underline">Back to match</Link></section></AppShell>;}
export default function Report(){return <Suspense><Content/></Suspense>;}
