"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Difficulty = "Easy" | "Medium" | "Advanced";
type QueueState = "idle" | "queued" | "matched";
const modes: Record<Difficulty, { key: "easy" | "medium" | "advanced"; format: string; description: string }> = {
  Easy: { key: "easy", format: "Best of 3 · 5 min rounds", description: "Core patterns, clean implementation, and quick decisions." },
  Medium: { key: "medium", format: "Best of 3 · 10 min rounds", description: "Data structures, graphs, and sharper problem solving." },
  Advanced: { key: "advanced", format: "First solve · 20 min", description: "Deep algorithms. One hard problem decides the match." },
};

export default function RankedQueuePage() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [state, setState] = useState<QueueState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const mode = modes[difficulty];

  const checkQueue = useCallback(async () => {
    const response = await fetch("/api/queue", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { status: QueueState; matchId?: string; difficulty?: string };
    if (data.status === "matched" && data.matchId) {
      setState("matched");
      router.push(`/match/lobby?matchId=${data.matchId}&level=${data.difficulty ?? "medium"}`);
    }
  }, [router]);
  useEffect(() => {
    if (state !== "queued") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    const poll = window.setInterval(() => void checkQueue(), 3000);
    return () => { window.clearInterval(timer); window.clearInterval(poll); };
  }, [checkQueue, state]);
  async function joinQueue() {
    setNotice(null);
    const response = await fetch("/api/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ difficulty: mode.key }) });
    const data = await response.json() as { matchId?: string; error?: string };
    if (!response.ok) { setNotice(data.error ?? "Could not join the queue."); return; }
    if (data.matchId) { router.push(`/match/lobby?matchId=${data.matchId}&level=${mode.key}`); return; }
    setElapsed(0); setState("queued");
  }
  async function leaveQueue() { await fetch("/api/queue", { method: "DELETE" }); setState("idle"); setElapsed(0); }

  return <main className="min-h-screen bg-[#f7f7f5] text-[#161616]"><header className="border-b border-black/10 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6"><Link href="/" className="text-xl font-bold tracking-[-0.06em]">CodeDuel<span className="text-[#ed5b39]">.</span></Link><p className="text-xs font-bold text-black/45">Ranked · Python</p></div></header><section className="mx-auto max-w-5xl px-6 py-12 sm:py-16"><div className="grid gap-8 lg:grid-cols-[1.3fr_.7fr]"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Ranked duel</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Choose your arena.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-black/60">You will be paired with a nearby-rated player in the same difficulty queue.</p><div className="mt-8 grid gap-3 sm:grid-cols-3">{(Object.keys(modes) as Difficulty[]).map((item) => <button key={item} disabled={state !== "idle"} onClick={() => setDifficulty(item)} className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed ${difficulty === item ? "border-[#ed5b39] bg-[#ed5b39] text-white" : "border-black/10 bg-white hover:border-black/35"}`}><p className="font-bold">{item}</p><p className={`mt-1 text-xs ${difficulty === item ? "text-white/70" : "text-black/45"}`}>{modes[item].format}</p></button>)}</div><div className="mt-5 rounded-xl border border-black/10 bg-white p-5"><p className="text-lg font-bold">{difficulty} queue</p><p className="mt-1 text-sm text-black/55">{mode.description}</p></div>{notice && <p className="mt-5 rounded-lg bg-[#fff0ed] p-4 text-sm text-[#c73d25]">{notice}</p>}</div><aside className="rounded-2xl bg-[#161616] p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">{state === "queued" ? "Searching" : "Ready when you are"}</p>{state === "queued" ? <><div className="mt-8 grid h-20 w-20 place-items-center rounded-full border-2 border-[#ed5b39] text-xl font-semibold">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div><h2 className="mt-7 text-2xl font-semibold tracking-[-0.04em]">Finding your opponent…</h2><p className="mt-3 text-sm leading-6 text-white/60">Searching the {difficulty} queue by hidden rating.</p><button onClick={() => void leaveQueue()} className="mt-8 w-full rounded-lg border border-white/25 px-4 py-3 text-sm font-bold hover:border-white">Leave queue</button></> : <><h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">A fair match awaits.</h2><p className="mt-3 text-sm leading-6 text-white/60">Same problems, server-side hidden tests, and no result until both players submit.</p><button onClick={() => void joinQueue()} className="mt-8 w-full rounded-lg bg-[#ed5b39] px-4 py-3 text-sm font-bold text-white hover:bg-[#d84c2b]">Find an opponent</button></>}</aside></div></section></main>;
}
