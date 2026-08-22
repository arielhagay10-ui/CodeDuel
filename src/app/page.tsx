"use client";

import { useState } from "react";
import Link from "next/link";

type Difficulty = "Easy" | "Medium" | "Advanced";

const difficulties: Array<{ name: Difficulty; range: string; time: string; description: string }> = [
  { name: "Easy", range: "800–1199", time: "3 × 5 min", description: "Patterns, arrays, strings, and clean implementation." },
  { name: "Medium", range: "1200–1599", time: "3 × 10 min", description: "Data structures, graphs, and sharper problem solving." },
  { name: "Advanced", range: "1600+", time: "First solve", description: "Deep algorithms. One hard problem decides the match." },
];

const ranks: Record<Difficulty, string> = {
  Easy: "Bronze II",
  Medium: "Silver II",
  Advanced: "Unranked",
};

export default function Home() {
  const [selected, setSelected] = useState<Difficulty>("Medium");
  const selectedDifficulty = difficulties.find((item) => item.name === selected)!;

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#161616]">
      <header className="border-b border-black/10 bg-[#f7f7f5]"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a className="text-xl font-bold tracking-[-0.06em]" href="#top">CodeDuel<span className="text-[#ed5b39]">.</span></a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-black/60 sm:flex"><a className="text-black" href="#play">Play</a><a href="#progress">Progress</a><a href="#leaderboard">Leaderboard</a></nav>
        <div className="flex items-center gap-3 text-sm"><span className="hidden text-black/50 sm:inline">Guest · Python</span><Link href="/sign-in" className="rounded-md bg-[#161616] px-3 py-2 text-xs font-bold text-white hover:bg-[#ed5b39]">Sign in</Link></div>
      </div></header>

      <section id="top" className="mx-auto max-w-6xl px-6 py-12 sm:py-16"><div className="flex flex-col justify-between gap-7 border-b border-black/10 pb-10 sm:flex-row sm:items-end">
        <div><p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Season zero</p><h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">Compete. Solve. Climb.</h1><p className="mt-5 max-w-xl text-base leading-7 text-black/60">Short, fair Python challenges for programmers ready to test their problem-solving under pressure.</p></div>
        <div className="grid min-w-56 grid-cols-2 gap-x-8 border-l-2 border-[#ed5b39] pl-5"><div><p className="text-2xl font-semibold">Silver II</p><p className="mt-1 text-xs uppercase tracking-wider text-black/45">Medium rank</p></div><div><p className="text-2xl font-semibold">12–5</p><p className="mt-1 text-xs uppercase tracking-wider text-black/45">Record</p></div></div>
      </div></section>

      <section id="play" className="mx-auto max-w-6xl px-6 pb-16"><div className="grid gap-5 lg:grid-cols-[1.65fr_1fr]">
        <div className="rounded-2xl bg-[#161616] p-6 text-white sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Ranked duel</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">Find your opponent</h2></div><span className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70">Best of 3</span></div>
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/60">You and your opponent receive the same problems. Win two rounds first to take the match.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">{difficulties.map((difficulty) => <button key={difficulty.name} onClick={() => setSelected(difficulty.name)} className={`rounded-xl border p-4 text-left transition ${selected === difficulty.name ? "border-[#ed5b39] bg-[#ed5b39] text-white" : "border-white/15 hover:border-white/40"}`}><p className="font-semibold">{difficulty.name}</p><p className={`mt-1 text-xs ${selected === difficulty.name ? "text-white/75" : "text-white/45"}`}>{difficulty.range}</p></button>)}</div>
          <div className="mt-7 flex flex-col gap-3 border-t border-white/15 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-white/55"><span className="font-medium text-white">{ranks[selected]}</span> · {selectedDifficulty.time} · {selectedDifficulty.description}</p><Link href="/sign-in" className="rounded-lg bg-white px-5 py-3 text-center text-sm font-bold text-[#161616] transition hover:bg-[#ed5b39] hover:text-white">Sign in to queue</Link></div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Solo practice</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">Train on your time.</h2><p className="mt-3 text-sm leading-6 text-black/60">Race your personal best, without rating pressure.</p><div className="my-7 border-y border-black/10 py-5"><p className="text-sm font-semibold">Pair Indices</p><div className="mt-2 flex gap-3 text-xs text-black/50"><span>Medium</span><span>·</span><span>10 min target</span><span>·</span><span>Python</span></div><p className="mt-4 text-sm text-black/55">Personal best: <span className="font-semibold text-black">—</span></p></div><Link href="/practice" className="block w-full rounded-lg border border-black/15 py-3 text-center text-sm font-bold transition hover:border-black hover:bg-black hover:text-white">Start practice as guest</Link></div>
      </div></section>

      <section id="progress" className="border-y border-black/10 bg-white"><div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-black/45">This week</p><p className="mt-2 text-3xl font-semibold tracking-tight">4h 18m</p><p className="mt-1 text-sm text-black/55">Focused practice time</p></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-black/45">Solved</p><p className="mt-2 text-3xl font-semibold tracking-tight">19 <span className="text-base font-normal text-[#21885d]">+6</span></p><p className="mt-1 text-sm text-black/55">Problems completed</p></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-black/45">Strongest skill</p><p className="mt-2 text-3xl font-semibold tracking-tight">Arrays</p><p className="mt-1 text-sm text-black/55">86% solve rate</p></div></div></section>
    </main>
  );
}
