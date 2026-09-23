"use client";
import Link from "next/link";
import { useCallback,useEffect,useRef,useState } from "react";
import { AppShell,buttonClass,ErrorNotice } from "@/components/app-shell";
import { ProblemPanel } from "@/components/problem-panel";
import { CodeEditor } from "@/components/code-editor";
import { api } from "@/lib/api-client";
import { readPracticeRun } from "@/lib/practice-storage";
import { practiceElapsedSeconds } from "@/lib/practice-timer";
import { useResource } from "@/lib/hooks/use-resource";
import { difficultyLabel,formatClock,verdictLabel } from "@/lib/match-view";
import type { Difficulty,PracticeRun,RoundProblem } from "@/types/api";
import type { PracticeSessionState } from "@/lib/client-contracts";
export default function PracticePage(){
  const [view,setView]=useState<"practice"|"stats">("practice");
  const {data:account,error:accountError}=useResource("practice-account",api.getMe);
  const [selected,setSelected]=useState(()=>{try{return localStorage.getItem("codeduel.practice.selected")??"";}catch{return "";}});
  const [candidate,setCandidate]=useState<string|null>(null);
  const [search,setSearch]=useState("");
  const [query,setQuery]=useState("");
  const [difficulty,setDifficulty]=useState<Difficulty|"all">("all");
  const [page,setPage]=useState(1);
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(search.trim());setPage(1);setCandidate(null);},250);return()=>clearTimeout(timer);},[search]);
  const loadCatalog=useCallback(()=>api.getProblemCatalog(query,difficulty,page),[query,difficulty,page]);
  const {data:catalog,error:catalogError}=useResource(`catalog:${query}:${difficulty}:${page}`,loadCatalog);
  const chosenId=selected||catalog?.problems[0]?.id||null;
  const preview=catalog?.problems.find(p=>p.id===candidate)??null;
  const loadProblem=useCallback(()=>chosenId?api.getProblem(chosenId):Promise.resolve(null),[chosenId]);
  const {data:problem,error:problemError}=useResource(`problem:${chosenId??"none"}`,loadProblem);
  const choose=(id:string)=>{setSelected(id);try{localStorage.setItem("codeduel.practice.selected",id);}catch{/* Device preference is optional. */}};
  const first=catalog?.total?((page-1)*catalog.pageSize+1):0;
  const last=catalog?Math.min(page*catalog.pageSize,catalog.total):0;
  return <AppShell><h1 className="mb-5 text-3xl font-semibold">Practice</h1><ErrorNotice message={catalogError??accountError??problemError}/>
    <div role="tablist" aria-label="Practice sections" className="mb-6 flex gap-2 border-b border-black/10 pb-3">
      {(["practice","stats"] as const).map(tab=><button key={tab} id={`${tab}-tab`} role="tab" aria-selected={view===tab} aria-controls={`${tab}-panel`} tabIndex={view===tab?0:-1} onClick={()=>setView(tab)} onKeyDown={event=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?"practice":event.key==="End"?"stats":view==="practice"?"stats":"practice";setView(next);document.getElementById(`${next}-tab`)?.focus();}}} className={`rounded-lg px-5 py-3 text-sm font-semibold ${view===tab?"bg-[#161616] text-white":"text-black/60 hover:bg-black/5"}`}>{tab==="practice"?"Practice":"My stats"}</button>)}
    </div>
    <div role="tabpanel" id={`${view}-panel`} aria-labelledby={`${view}-tab`}>
    {view==="stats"&&<p className="mb-4 text-sm text-black/60">Any active timed attempt keeps running while you view stats.</p>}
    {!catalog&&!catalogError&&<p>Loading published problems…</p>}
    <section hidden={view==="stats"} aria-label="Problem library" className="mb-6 rounded-xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-0 flex-1 text-sm font-semibold">Find a problem
          <input id="practice-problem-search" type="search" maxLength={80} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title, description, or topic…" className="mt-1.5 block w-full rounded-lg border border-black/20 px-3 py-2.5 font-normal"/>
        </label>
        <label className="text-sm font-semibold">Difficulty
          <select aria-label="Filter by difficulty" value={difficulty} onChange={e=>{setDifficulty(e.target.value as Difficulty|"all");setPage(1);setCandidate(null);}} className="mt-1.5 block rounded-lg border border-black/20 bg-white px-3 py-2.5 font-normal">
            <option value="all">All difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="advanced">Advanced</option>
          </select>
        </label>
      </div>
      {catalog&&<details className="mt-3"><summary className="w-fit cursor-pointer text-xs text-black/60">Browse {catalog.availableTags.length} topics</summary><div role="group" aria-label="Browse topics" className="mt-2 flex flex-wrap gap-1.5">{catalog.availableTags.map(tag=><button key={tag} onClick={()=>setSearch(tag)} className={`rounded-full border px-2 py-1 text-xs ${search===tag?"border-[#c73d25] bg-[#fbebe5]":"border-black/10 hover:bg-black/5"}`} aria-pressed={search===tag}>• {tag}</button>)}</div></details>}
      <div className="my-3 flex items-center justify-between gap-3 text-xs text-black/60"><p role="status">{catalog?`${first}–${last} of ${catalog.total}`:"Searching…"}{problem?` · Selected: ${problem.title}`:""}</p>{search&&<button className="underline" onClick={()=>setSearch("")}>Clear search</button>}</div>
      <ul className="grid max-h-72 gap-1.5 overflow-y-auto">
        {catalog?.problems.map(p=><li key={p.id}><button aria-pressed={(candidate??chosenId)===p.id} onClick={()=>setCandidate(p.id)} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border px-3 py-2 text-left ${(candidate??chosenId)===p.id?"border-[#c73d25] bg-[#fbebe5]":"border-black/10 hover:bg-black/5"}`}><span className="truncate text-sm font-medium">{p.title}</span><span className="text-xs text-black/55">{difficultyLabel(p.difficulty)}</span><span className="col-span-2 truncate text-xs tracking-wide text-[#a9321d]">{p.tags.map(tag=>`• ${tag}`).join("   ")}</span></button></li>)}
      </ul>
      {preview&&<section aria-label="Selected problem preview" className="mt-4 rounded-lg border border-[#ed5b39]/40 bg-[#fff5ef] p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">{preview.title}</h2><span className="text-xs text-black/55">{difficultyLabel(preview.difficulty)}</span></div><p className="mt-2 text-sm text-black/70">{preview.summary}</p><p className="mt-2 text-xs text-[#a9321d]">{preview.tags.map(tag=>`• ${tag}`).join("   ")}</p><div className="mt-4 flex flex-wrap gap-2"><button className={buttonClass} onClick={()=>{choose(preview.id);setCandidate(null);}}>Go to question</button><button className="rounded-lg border border-black/20 bg-white px-5 py-3 text-sm font-semibold hover:bg-black/5" onClick={()=>setCandidate(null)}>Choose another</button></div></section>}
      {catalog?.total===0&&<p className="py-3 text-sm">No matching problems. <button className="underline" onClick={()=>{setSearch("");setDifficulty("all");setPage(1);}}>Clear filters</button></p>}
      {catalog&&catalog.total>catalog.pageSize&&<nav aria-label="Problem pages" className="mt-3 flex items-center justify-end gap-2 text-xs"><button disabled={page===1} onClick={()=>{setPage(page-1);setCandidate(null);}} className="rounded border px-2.5 py-1.5 disabled:opacity-40">Previous</button><span>Page {page} of {Math.ceil(catalog.total/catalog.pageSize)}</span><button disabled={last>=catalog.total} onClick={()=>{setPage(page+1);setCandidate(null);}} className="rounded border px-2.5 py-1.5 disabled:opacity-40">Next</button></nav>}
    </section>
    {catalog?.total===0&&!selected&&<p>No published problems match these filters.</p>}
    {problem&&account&&!candidate&&<PracticeEditor key={problem.id+String(account.user?.id)} problem={problem} userId={account.user?.id??null} onSelectProblem={choose} view={view} onBrowseProblems={()=>{setView("practice");document.getElementById("practice-problem-search")?.focus();}}/>}
    </div>
  </AppShell>;
}
function PracticeEditor({problem,userId,onSelectProblem,view,onBrowseProblems}:{problem:RoundProblem;userId:string|null;onSelectProblem:(id:string)=>void;view:"practice"|"stats";onBrowseProblems:()=>void}) {
  const storageKey=`codeduel.practice.${userId??"guest"}.${problem.id}`;
  const [code,setCode]=useState(()=>{try{return localStorage.getItem(storageKey)??problem.starterCode;}catch{return problem.starterCode;}});
  const [now,setNow]=useState(0),[busy,setBusy]=useState(false),[guestStarted,setGuestStarted]=useState(false);
  const [confirmAbandon,setConfirmAbandon]=useState(false);
  const nextActions=useRef<HTMLElement>(null);
  const loadSession=useCallback(async()=>{
    const state:PracticeSessionState=userId?await api.getPracticeSession(problem.id):{session:null,activeTimed:null,stats:{timedSolves:0,bestSeconds:null,abandonedAttempts:0,recent:[]},comparisons:[]};
    return {...state,receivedAt:performance.now()};
  },[userId,problem.id]);
  const {data:progress,error:sessionError,refresh:refreshSession}=useResource(`practice-session:${userId}:${problem.id}`,loadSession,userId?5000:0);
  const session=progress?.session;
  const ended=!!(session?.completedAt||session?.abandonedAt);
  useEffect(()=>{
    if(ended&&view==="practice"){
      nextActions.current?.focus({preventScroll:true});
      nextActions.current?.scrollIntoView({block:"start"});
    }
  },[ended,view]);
  const otherTimed=progress?.activeTimed?.problemId!==problem.id?progress?.activeTimed:null;
  const seconds=session&&progress?practiceElapsedSeconds(session,progress.receivedAt,now):0;
  const [result,setResult]=useState<PracticeRun|null>(()=>{try{return readPracticeRun(localStorage,storageKey+".result");}catch{return null;}}),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState("Drafts stay on this device.");
  useEffect(()=>{const timer=setInterval(()=>setNow(performance.now()),1000);return()=>clearInterval(timer);},[]);
  async function start(timed:boolean,abandonSessionId?:string){
    if(!userId){setGuestStarted(true);return;}
    setBusy(true);setError(null);
    try{await api.startPracticeSession(problem.id,timed,abandonSessionId);setResult(null);try{localStorage.removeItem(storageKey+".result");}catch{/* Optional history. */}if(ended){setCode(problem.starterCode);try{localStorage.setItem(storageKey,problem.starterCode);}catch{/* Optional draft storage. */}}setConfirmAbandon(false);refreshSession();}
    catch(e){setError(e instanceof Error?e.message:"Could not start practice.");refreshSession();}finally{setBusy(false);}
  }
  async function abandon(){if(!session)return;setBusy(true);setError(null);try{await api.abandonPracticeSession(session.id);setConfirmAbandon(false);}catch(e){setError(e instanceof Error?e.message:"Could not abandon attempt.");}finally{refreshSession();setBusy(false);}}
  useEffect(()=>{
    if(!result||!["queued","running"].includes(result.verdict))return;
    let stopped=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{try{const next=await api.getPractice(result.id);if(stopped)return;setError(null);
      if(["queued","running"].includes(next.verdict))timer=setTimeout(poll,2000);
      else {setResult(next);refreshSession();try{localStorage.setItem(storageKey+".result",JSON.stringify(next));}catch{/* optional history */}}
    }catch(e){if(!stopped){setError(e instanceof Error?e.message:"Result unavailable; retry polling.");timer=setTimeout(poll,5000);}}};
    timer=setTimeout(poll,1000);return()=>{stopped=true;clearTimeout(timer);};
  },[result,storageKey,refreshSession]);
  async function run(){if(!userId||busy||!session||ended)return;setBusy(true);setError(null);try{const next=await api.runPractice(problem.slug,code,session.id);setResult(next);try{localStorage.setItem(storageKey+".result",JSON.stringify(next));}catch{/* Device history is optional. */}}catch(e){setError(e instanceof Error?e.message:"Run failed.");refreshSession();}finally{setBusy(false);}}
  if(!progress)return <div><ErrorNotice message={sessionError}/><p>Loading practice progress…</p></div>;
  if(view==="stats")return userId?<><ErrorNotice message={sessionError}/><PracticeStats progress={progress} title={problem.title}/></>:<section className="rounded-xl border border-black/10 bg-white p-6"><h2 className="text-xl font-semibold">My stats</h2><p className="mt-3">Sign in to save practice times and track your progress.</p><Link className={`${buttonClass} mt-4`} href="/sign-in">Sign in</Link></section>;
  const startButtons=<div className="flex flex-wrap gap-3"><button className={buttonClass} disabled={busy} onClick={()=>void start(false)}>Start untimed</button>{userId?<button className={buttonClass} disabled={busy} onClick={()=>void start(true,otherTimed?.id)}>{otherTimed?"Abandon current and start timed here":"Start timed"}</button>:<Link href="/sign-in" className="underline">Sign in for timed practice and saved stats</Link>}</div>;
  const resumeBanner=otherTimed?<aside className="mb-4 rounded-lg border border-[#c73d25]/30 bg-[#fbebe5] p-4 text-sm text-[#161616]"><p>You have a timed attempt in progress: <strong>{otherTimed.title}</strong>. Its clock is still running. Abandoning it preserves the record but excludes it from solve-time averages.</p><button className="mt-2 underline" onClick={()=>onSelectProblem(otherTimed.problemId)}>Resume {otherTimed.title}</button></aside>:null;
  if(!session&&!guestStarted)return <section className="rounded-xl border border-black/10 bg-white p-6"><h2 className="text-xl font-semibold">{problem.title}</h2><p className="my-4 text-sm">Choose how to practice. Only one timed attempt can be active. Its clock continues until public tests pass or you abandon it. Untimed practice is unrestricted.</p>{resumeBanner}<ErrorNotice message={error??sessionError}/>{startButtons}</section>;
  return <>{resumeBanner}{ended&&<section ref={nextActions} tabIndex={-1} aria-label="Next practice attempt" className="mb-6 scroll-mt-6 rounded-xl border-2 border-[#ed5b39] bg-[#fff5ef] p-6 outline-none"><h2 className="text-xl font-semibold">{session?.abandonedAt?"Attempt abandoned":"Attempt complete"} · {problem.title}</h2><p className="mb-5 mt-2 text-sm text-black/65">{session?.abandonedAt?"Your history is saved. Choose what to do next.":"Your result is saved. Try again or choose another problem."}</p>{startButtons}<button className="mt-4 rounded-lg border border-black/20 bg-white px-5 py-3 text-sm font-semibold hover:bg-black/5" onClick={onBrowseProblems}>Choose a different problem</button><ErrorNotice message={error??sessionError}/></section>}<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"><ProblemPanel problem={problem}/><section className="min-w-0 rounded-xl bg-[#171717] p-4 text-white sm:p-6">
    <p className="mb-2 font-mono">{session?.timed?`${formatClock(seconds)} elapsed${session.abandonedAt?" · Abandoned":session.completedAt?" · Completed":""}`:`Untimed practice${session?.abandonedAt?" · Abandoned":""}`}</p>
    <p className="mb-4 text-xs text-white/60">{session?.abandonedAt?"Attempt abandoned. This time is excluded from solve-time statistics.":session?.completedAt?"Public tests passed. Your completed attempt is saved.":session?.timed?"Clock continues through refreshes and time away. Abandon the attempt when you stop working on it.":"Take your time. This attempt does not count toward timed statistics."}</p>
    <CodeEditor spacious disabled={ended} label="Practice code editor" value={code} onChange={value=>{setCode(value);try{localStorage.setItem(storageKey,value);setSaved("Saved on this device");}catch{setSaved("Storage unavailable — keep this tab open");}}}/><p className="my-3 text-xs text-white/60">{saved} · Drag the editor’s bottom edge to resize.</p>
    <ErrorNotice message={error??sessionError}/><p role="status" className="my-4">{result?`Last run: ${verdictLabel(result.verdict)} · ${result.testsPassed}/${result.testsTotal} public tests`:"Run your solution against public examples. Results do not affect rank."}</p>
    {!ended&&(userId?<div className="flex flex-wrap items-center gap-4"><button className={buttonClass} disabled={busy||!!result&&["queued","running"].includes(result.verdict)} onClick={()=>void run()}>{busy?"Queuing…":"Run public tests"}</button><button disabled={busy} className="underline" onClick={()=>setConfirmAbandon(true)}>Abandon attempt</button></div>:<Link href="/sign-in" className="underline">Sign in to run Python</Link>)}
    {confirmAbandon&&!ended&&<div className="mt-4 rounded border border-white/30 p-4"><p>End this attempt? It will remain marked abandoned and will not count toward solve-time averages.</p><div className="mt-3 flex gap-4"><button disabled={busy} className="underline" onClick={()=>void abandon()}>Confirm abandon</button><button onClick={()=>setConfirmAbandon(false)}>Keep working</button></div></div>}
  </section></div></>;
}

function PracticeStats({progress,title}:{progress:PracticeSessionState;title:string}){
  return <section className="rounded-xl border border-black/10 bg-white p-6"><h2 className="text-2xl font-semibold">My stats</h2><h3 className="mt-6 font-semibold">Selected problem · {title}</h3><p className="mt-2 text-sm text-black/60">{progress.stats.timedSolves} completions · {progress.stats.abandonedAttempts} abandoned</p>
    {progress.stats.recent.slice(0,3).map((run,index)=><p key={index} className="mt-2 text-sm">{index===0?"Latest":"Earlier"}: {formatClock(run.seconds)} · {run.firstSolve?"First solve":"Repeat solve"}</p>)}
    <h3 className="mt-8 font-semibold">All problems · by difficulty and topic</h3>{progress.comparisons.length?<div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-black/5"><tr><th className="p-3">Category</th><th className="p-3">Solve type</th><th className="p-3">Count</th><th className="p-3">Average</th></tr></thead><tbody>{progress.comparisons.map(row=><tr className="border-b border-black/5" key={`${row.difficulty}:${row.tag}:${row.firstSolve}`}><td className="p-3">{difficultyLabel(row.difficulty)}{row.tag?` · #${row.tag}`:" · All topics"}</td><td className="p-3">{row.firstSolve?"First":"Repeat"}</td><td className="p-3">{row.count}</td><td className="p-3">{formatClock(row.averageSeconds)}</td></tr>)}</tbody></table></div>:<p className="mt-2 text-sm">Complete a timed attempt to see comparisons.</p>}
    <p className="mt-5 text-xs text-black/60">Public-test completion times only. First solves and repeats are counted separately; untimed and abandoned attempts are excluded.</p></section>;
}
