"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ReconnectingPage() {
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (seconds === 0) return;
    const timer = window.setInterval(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]">
      <section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 text-center shadow-[0_20px_60px_rgb(0_0_0_/_0.08)]">
        <span className="grid mx-auto h-12 w-12 place-items-center rounded-full bg-[#fbebe5] text-xl text-[#c73d25]">!</span>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Ranked duel paused locally</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Reconnecting…</h1>
        <p className="mt-4 text-sm leading-6 text-black/60">Your connection dropped. We are trying to restore your match. The round clock continues, and you forfeit if you cannot reconnect in time.</p>
        <p className="mt-8 font-mono text-5xl font-semibold tracking-tight">0:{seconds.toString().padStart(2, "0")}</p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.13em] text-black/45">Reconnect window</p>
        <button onClick={() => setSeconds(0)} className="mt-8 w-full rounded-lg bg-[#161616] py-3 text-sm font-bold text-white">Retry connection</button>
        <Link href="/" className="mt-4 inline-block text-sm font-bold text-black/55 underline decoration-black/25 underline-offset-4">Leave match</Link>
      </section>
    </main>
  );
}
