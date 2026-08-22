"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function MatchLobbyContent() {
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const level = useSearchParams().get("level") ?? "Medium";

  useEffect(() => {
    if (!ready) return;
    let countdownTimer: number | undefined;
    const opponentTimer = window.setTimeout(() => {
      setCountdown(3);
      countdownTimer = window.setInterval(() => setCountdown((value) => value === null || value === 0 ? 0 : value - 1), 1000);
    }, 900);
    return () => { window.clearTimeout(opponentTimer); if (countdownTimer) window.clearInterval(countdownTimer); };
  }, [ready]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]">
      <section className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white p-7 shadow-[0_20px_60px_rgb(0_0_0_/_0.08)] sm:p-10"><header className="flex items-center justify-between"><Link href="/queue" className="text-xl font-bold tracking-[-0.06em]">CodeDuel<span className="text-[#ed5b39]">.</span></Link><span className="rounded-full bg-[#fbebe5] px-3 py-1 text-xs font-bold text-[#c73d25]">{level} ranked</span></header><p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Match found</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">Meet your opponent.</h1><div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto_1fr]"><div className="rounded-xl border border-black/10 p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">You</p><p className="mt-3 text-xl font-bold">@ArrayNinja</p><p className="mt-1 text-sm text-black/55">Silver II · 1412</p></div><p className="self-center text-center text-xs font-bold uppercase tracking-[0.18em] text-black/35">vs</p><div className="rounded-xl border border-black/10 p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Opponent</p><p className="mt-3 text-xl font-bold">@GraphRunner</p><p className="mt-1 text-sm text-black/55">Silver II · 1407</p></div></div><div className="mt-6 rounded-xl bg-[#f4f4f1] p-5"><p className="font-bold">Match format</p><p className="mt-2 text-sm leading-6 text-black/60">Best of 3. Both players receive identical timed problems. AI, search, and outside help are prohibited.</p></div>{countdown !== null ? <div className="mt-7 rounded-xl bg-[#161616] px-5 py-4 text-center text-white"><p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Round one starts in</p><p className="mt-1 text-4xl font-semibold">{countdown === 0 ? "Go" : countdown}</p>{countdown === 0 && <Link href={`/match/round?level=${level}`} className="mt-3 inline-block text-sm font-bold text-[#ed5b39]">Open round one</Link>}</div> : ready ? <div className="mt-7 rounded-lg border border-[#a8d8bd] bg-[#e9f6ef] px-4 py-3 text-sm text-[#167149]">You are ready. Waiting for @GraphRunner…</div> : <button onClick={() => setReady(true)} className="mt-7 w-full rounded-lg bg-[#161616] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#ed5b39]">Ready up</button>}<Link href="/queue" className="mt-5 block text-center text-xs font-bold text-black/45 hover:text-black">Leave match</Link></section>
    </main>
  );
}

export default function MatchLobbyPage() {
  return <Suspense><MatchLobbyContent /></Suspense>;
}
