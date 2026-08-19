"use client";

import Link from "next/link";
import { useState } from "react";

export default function MatchCompletePage() {
  const [requested, setRequested] = useState(false);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]">
      <section className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgb(0_0_0_/_0.08)] sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Ranked duel · Medium</p>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-semibold tracking-[-0.055em]">Match victory.</h1><p className="mt-2 text-sm text-black/60">You won 2–1 against KiteByte.</p></div><div className="rounded-xl bg-[#e9f6ef] px-4 py-3 text-right"><p className="text-xl font-bold text-[#167149]">+28</p><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#167149]/70">Medium rank progress</p></div></div>
        <div className="mt-8 grid grid-cols-3 border-y border-black/10 py-5 text-center"><div><p className="text-2xl font-semibold">2</p><p className="mt-1 text-xs uppercase tracking-wider text-black/45">Rounds won</p></div><div className="border-x border-black/10"><p className="text-2xl font-semibold">13:42</p><p className="mt-1 text-xs uppercase tracking-wider text-black/45">Solve time</p></div><div><p className="text-2xl font-semibold">Silver II</p><p className="mt-1 text-xs uppercase tracking-wider text-black/45">Current rank</p></div></div>
        <div className="mt-8 rounded-xl bg-[#f4f4f1] p-5"><p className="font-semibold">Play KiteByte again?</p><p className="mt-1 text-sm leading-6 text-black/60">A rematch is a new rated match with a fresh set of Medium problems. Your first match result is already final.</p><div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center"><Link href="/" className="rounded-lg px-4 py-3 text-center text-sm font-bold text-black/60 hover:text-black">Back to dashboard</Link><Link href="/players/kitebyte" className="px-3 py-3 text-sm font-bold text-black/55 underline decoration-black/20 underline-offset-4 hover:text-black">View profile</Link><Link href="/match/report" className="px-3 py-3 text-sm font-bold text-black/55 underline decoration-black/20 underline-offset-4 hover:text-black">Report player</Link></div><button onClick={() => setRequested(true)} disabled={requested} className="rounded-lg bg-[#161616] px-5 py-3 text-sm font-bold text-white disabled:bg-[#21885d]">{requested ? "Request sent — waiting" : "Request rematch"}</button></div>{requested && <p className="mt-4 rounded-lg border border-[#a8d8bd] bg-[#e9f6ef] px-4 py-3 text-sm text-[#167149]">KiteByte has 60 seconds to accept. If they decline or do not respond, you can return to the queue.</p>}</div>
      </section>
    </main>
  );
}
