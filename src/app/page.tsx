"use client";
import Link from "next/link";
import { AppShell,buttonClass,ErrorNotice } from "@/components/app-shell";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/hooks/use-resource";
import { difficultyLabel,rankLabel } from "@/lib/match-view";
async function dashboard() {const account=await api.getMe();return {account,ratings:account.user?.rankedAccess&&!account.user.banned?await api.getRatings():null};}
export default function Home() {
  const {data,error}=useResource("dashboard",dashboard);
  const signedOut=!data?.account.user;
  return <AppShell compact={signedOut}>
    <div>
    <p className={`font-bold text-[#ed5b39] ${signedOut?"text-xs uppercase tracking-widest":"text-sm"}`}>Python coding duels</p><h1 className={`max-w-3xl font-semibold tracking-tight ${signedOut?"mt-2 text-4xl sm:text-5xl":"mt-4 text-5xl"}`}>Compete. Solve. Climb.</h1>
    <p className={`max-w-xl leading-7 text-black/60 ${signedOut?"my-3":"my-6"}`}>Practice at your pace, complete five placements per difficulty, then compete in timed matches.</p><ErrorNotice message={error}/>
    <div className={`grid md:grid-cols-2 ${signedOut?"mt-5 gap-3 sm:gap-4":"mt-8 gap-6"}`}><section className={`rounded-2xl bg-white ${signedOut?"p-5 sm:p-6":"p-8"}`}><h2 className="text-2xl font-bold">Ranked duels</h2><p className={`text-black/60 ${signedOut?"my-2 text-sm leading-5":"my-4"}`}>Easy and Medium use up to three rounds. Advanced has one round. The server judges both solutions before revealing results.</p><Link className={buttonClass} href={data?.account.user?"/sign-in/continue":"/sign-in"}>Play ranked</Link></section>
    <section className={`rounded-2xl bg-[#161616] text-white ${signedOut?"p-5 sm:p-6":"p-8"}`}><h2 className="text-2xl font-bold">Solo practice</h2><p className={`text-white/70 ${signedOut?"my-2 text-sm leading-5":"my-4"}`}>Browse published problems and keep drafts on this device. Sign in to run Python against public examples.</p><Link className="inline-block rounded-lg bg-[#ed5b39] px-5 py-3 font-bold" href="/practice">Browse practice</Link></section></div>
    </div>
    {!signedOut&&<>
    <section className="mt-10"><h2 className="mb-4 text-2xl font-bold">Your ranks</h2>{data?.ratings?<div className="grid gap-4 sm:grid-cols-3">{data.ratings.ratings.map(r=><div key={r.difficulty} className="rounded-xl border border-black/10 bg-white p-6"><h3>{difficultyLabel(r.difficulty)}</h3><p className="mt-2 text-xl font-bold">{rankLabel(r.rank)}</p><p className="mt-2 text-sm text-black/60">{r.placementsCompleted}/5 placements</p></div>)}</div>:<p className="text-black/60">Sign in and complete onboarding to see your progress.</p>}<Link href="/onboarding/placement" className="mt-5 inline-block underline">Complete placements</Link></section>
    </>}
  </AppShell>;
}
