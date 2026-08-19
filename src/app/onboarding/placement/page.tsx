"use client";

import Link from "next/link";
import { useState } from "react";

type Level = "Easy" | "Medium" | "Advanced";

const placements = [
  ["Foundations", "Arrays, strings, and implementation", "8 min"],
  ["Patterns", "Hash maps, two pointers, and sorting", "10 min"],
  ["Structures", "Stacks, queues, and linked lists", "12 min"],
  ["Traversal", "Trees, graphs, and search", "14 min"],
  ["Final signal", "A focused challenge to calibrate your rank", "15 min"],
];

const levelCopy: Record<Level, string> = {
  Easy: "A confident start with core programming patterns.",
  Medium: "A practical measure of your data-structure fluency.",
  Advanced: "Harder algorithmic decisions under a tighter signal.",
};

export default function PlacementPage() {
  const [level, setLevel] = useState<Level>("Medium");
  const [started, setStarted] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-5 py-8 text-[#161616] sm:px-8 sm:py-12">
      <header className="mx-auto flex max-w-4xl items-center justify-between"><Link href="/" className="text-xl font-bold tracking-[-0.06em]">CodeWars<span className="text-[#ed5b39]">.</span></Link><p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">Step 3 of 3</p></header>
      <section className="mx-auto mt-12 max-w-4xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Ranked placement</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Find your starting rank.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-black/60">Complete five independent placements at the level you want to play. Your results set a fair initial rank for that queue.</p>
        <div className="mt-8 grid gap-2 rounded-xl border border-black/10 bg-white p-2 sm:grid-cols-3">{(["Easy", "Medium", "Advanced"] as Level[]).map((item) => <button key={item} onClick={() => { setLevel(item); setStarted(null); }} className={`rounded-lg px-4 py-3 text-left transition ${level === item ? "bg-[#161616] text-white" : "hover:bg-black/5"}`}><span className="block text-sm font-bold">{item}</span><span className={`mt-1 block text-xs ${level === item ? "text-white/60" : "text-black/45"}`}>{item === "Easy" ? "800–1199" : item === "Medium" ? "1200–1599" : "1600+"}</span></button>)}</div>
        <p className="mt-4 text-sm text-black/55">{levelCopy[level]} You can take another level later.</p>
        <div className="mt-8 space-y-3">{placements.map(([title, detail, time], index) => <article key={title} className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fbebe5] text-sm font-bold text-[#c73d25]">{index + 1}</span><div><div className="flex items-center gap-2"><h2 className="font-bold">{title}</h2><span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold text-black/55">{level}</span></div><p className="mt-1 text-sm text-black/55">{detail} · {time}</p></div></div><Link href={`/onboarding/placement/${index + 1}?level=${level}`} onClick={() => setStarted(index)} className="rounded-lg border border-black/15 px-4 py-2.5 text-center text-sm font-bold hover:border-black hover:bg-black hover:text-white">{started === index ? "Placement ready" : "Start"}</Link></article>)}</div>
        <p className="mt-6 text-center text-xs leading-5 text-black/45">Each placement is timed and must be completed without AI, search, or outside help.</p>
      </section>
    </main>
  );
}
