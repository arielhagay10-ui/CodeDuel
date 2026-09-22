"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { AppShell,buttonClass,ErrorNotice } from "@/components/app-shell";
import { ProblemPanel } from "@/components/problem-panel";
import { CodeEditor } from "@/components/code-editor";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/hooks/use-resource";
import { formatClock,verdictLabel } from "@/lib/match-view";
import type { PracticeRun,RoundProblem } from "@/types/api";
async function loadPractice(){const [catalog,account]=await Promise.all([api.getProblems(),api.getMe()]);return {...catalog,...account};}
export default function PracticePage(){
  const {data,error}=useResource("practice",loadPractice);const [selected,setSelected]=useState("");
  const problem=data?.problems.find(p=>p.id===selected)??data?.problems[0];
  return <AppShell><h1 className="mb-5 text-3xl font-semibold">Practice</h1><ErrorNotice message={error}/>
    {!data&&!error&&<p>Loading published problems…</p>}
    {data&&<label className="mb-6 block">Choose a problem<select className="ml-3 max-w-full rounded border bg-white p-3" value={problem?.id??""} onChange={e=>setSelected(e.target.value)}>{data.problems.map(p=><option key={p.id} value={p.id}>{p.title} · {p.difficulty}</option>)}</select></label>}
    {data&&!problem&&<p>No published problems are available.</p>}
    {problem&&data&&<PracticeEditor key={problem.id+String(data.user?.id)} problem={problem} userId={data.user?.id??null}/>}
  </AppShell>;
}
function PracticeEditor({problem,userId}:{problem:RoundProblem;userId:string|null}) {
  const storageKey=`codeduel.practice.${userId??"guest"}.${problem.id}`;
  const [code,setCode]=useState(()=>{try{return localStorage.getItem(storageKey)??problem.starterCode;}catch{return problem.starterCode;}});
  const [seconds,setSeconds]=useState(600),[paused,setPaused]=useState(false),[busy,setBusy]=useState(false);
  const [result,setResult]=useState<PracticeRun|null>(null),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState("Drafts stay on this device.");
  useEffect(()=>{if(paused)return;const timer=setInterval(()=>setSeconds(s=>Math.max(0,s-1)),1000);return()=>clearInterval(timer);},[paused]);
  useEffect(()=>{
    if(!result||!["queued","running"].includes(result.verdict))return;
    let stopped=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{try{const next=await api.getPractice(result.id);if(stopped)return;
      if(["queued","running"].includes(next.verdict))timer=setTimeout(poll,2000);
      else {setResult(next);try{localStorage.setItem(storageKey+".result",JSON.stringify(next));}catch{/* optional history */}}
    }catch(e){if(!stopped){setError(e instanceof Error?e.message:"Result unavailable; retry polling.");timer=setTimeout(poll,5000);}}};
    timer=setTimeout(poll,1000);return()=>{stopped=true;clearTimeout(timer);};
  },[result,storageKey]);
  async function run(){if(!userId||busy)return;setBusy(true);setError(null);try{setResult(await api.runPractice(problem.slug,code));}catch(e){setError(e instanceof Error?e.message:"Run failed.");}finally{setBusy(false);}}
  return <div className="grid gap-6 lg:grid-cols-2"><ProblemPanel problem={problem}/><section className="rounded-xl bg-[#171717] p-6 text-white">
    <div className="mb-4 flex items-center justify-between"><span className="font-mono">{formatClock(seconds)}</span><button onClick={()=>setPaused(p=>!p)}>{paused?"Resume timer":"Pause timer"}</button></div>
    <CodeEditor label="Practice code editor" value={code} onChange={value=>{setCode(value);try{localStorage.setItem(storageKey,value);setSaved("Saved on this device");}catch{setSaved("Storage unavailable — keep this tab open");}}}/><p className="my-3 text-xs text-white/60">{saved}</p>
    <ErrorNotice message={error}/><p role="status" className="my-4">{result?`${verdictLabel(result.verdict)} · ${result.testsPassed}/${result.testsTotal} public tests`:"Run your solution against public examples. Results do not affect rank."}</p>
    {userId?<button className={buttonClass} disabled={busy||!!result&&["queued","running"].includes(result.verdict)} onClick={()=>void run()}>{busy?"Queuing…":"Run public tests"}</button>:<Link href="/sign-in" className="underline">Sign in to run Python</Link>}
  </section></div>;
}
