"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const starter = "def pair_indices(numbers, target):\n    # Return indices of two values whose sum is target.\n    pass\n";

function clock(total: number) { return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`; }

function MatchRoundContent() {
  const searchParams = useSearchParams();
  const level = searchParams.get("level") ?? "Medium";
  const round = searchParams.get("round") ?? "1";
  const [seconds, setSeconds] = useState(600);
  const [code, setCode] = useState(starter);
  const [submitted, setSubmitted] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [opponentStatus, setOpponentStatus] = useState("Working");
  const bothSubmitted = submitted && opponentStatus === "Submitted";

  useEffect(() => {
    if (seconds === 0 || submitted) return;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value > 1) return value - 1;
      setAutoSubmitted(true);
      setSubmitted(true);
      return 0;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [seconds, submitted]);

  useEffect(() => {
    if (!submitted) return;
    const timer = window.setTimeout(() => setOpponentStatus("Submitted"), 1800);
    return () => window.clearTimeout(timer);
  }, [submitted]);

  return <main className="min-h-screen bg-[#f7f7f5] text-[#161616]"><header className="border-b border-black/10 bg-white"><div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8"><Link href="/" className="text-xl font-bold tracking-[-0.06em]">CodeWars<span className="text-[#ed5b39]">.</span></Link><div className="flex items-center gap-4"><span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Round {round} · {level}</span><span className="font-mono text-lg font-semibold">{clock(seconds)}</span></div></div></header><div className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(360px,.9fr)_minmax(460px,1.1fr)]"><article className="border-b border-black/10 bg-white px-6 py-8 lg:min-h-[calc(100vh-64px)] lg:border-r lg:border-b-0 lg:px-10"><div className="flex items-center justify-between"><span className="rounded-full bg-[#fbebe5] px-3 py-1 text-xs font-bold text-[#c73d25]">{level}</span><span className="text-xs font-bold text-black/45">Best of 3</span></div><h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em]">Pair Indices</h1><p className="mt-6 max-w-xl leading-7 text-black/70">Given a list of integers and a target, return the indices of two different values that add up to the target.</p><section className="mt-8"><h2 className="text-sm font-bold uppercase tracking-[0.14em] text-black/45">Example</h2><pre className="mt-3 rounded-xl bg-[#f4f4f1] p-4 font-mono text-sm leading-6">numbers = [2, 7, 11, 15]\ntarget = 9\n\npair_indices(numbers, target)\n# [0, 1]</pre></section><div className="mt-8 rounded-xl border border-black/10 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-bold">@GraphRunner</p><p className="mt-1 text-xs text-black/45">Opponent status</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${opponentStatus === "Submitted" ? "bg-[#e9f6ef] text-[#167149]" : "bg-[#f4f4f1] text-black/55"}`}>{opponentStatus}</span></div></div><p className="mt-5 text-xs leading-5 text-black/45">Only status is shared during the round. Solutions and test results stay private until both players submit.</p></article><section className="flex min-h-[620px] flex-col bg-[#171717] p-4 sm:p-6"><div className="mb-3 flex items-center justify-between"><span className="rounded bg-[#2c2c2c] px-2.5 py-1.5 text-xs font-medium text-white">Python 3.12</span><span className="text-xs text-white/45">Autosaved</span></div><textarea disabled={submitted} aria-label="Match code editor" value={code} onChange={(event) => setCode(event.target.value)} spellCheck="false" className="min-h-72 flex-1 resize-none rounded-xl border border-white/10 bg-[#111] p-5 font-mono text-sm leading-7 text-[#e9e9e4] outline-none focus:border-[#ed5b39] disabled:opacity-70" />{submitted ? <div className="mt-4 rounded-xl border border-[#77c69b] bg-[#143321] p-4 text-sm text-[#bcf1d1]">{bothSubmitted ? "Both solutions are locked. Results are ready." : autoSubmitted ? "Time expired. Your current code was submitted automatically; waiting for @GraphRunner." : "Your solution is locked. Waiting for @GraphRunner to submit."}</div> : <div className="mt-4 rounded-xl border border-white/10 bg-[#111] p-4 text-sm text-white/60">Submitting locks this round. At 0:00, your current code is submitted automatically.</div>}<div className="mt-4 flex justify-end">{bothSubmitted ? <Link href={`/match/results?level=${level}`} className="rounded-lg bg-[#ed5b39] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#d84c2b]">Reveal round result</Link> : submitted ? <button disabled className="rounded-lg bg-white/15 px-4 py-2.5 text-sm font-bold text-white/50">Waiting for opponent</button> : <button onClick={() => setSubmitted(true)} className="rounded-lg bg-[#ed5b39] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#d84c2b]">Submit solution</button>}</div></section></div></main>;
}

export default function MatchRoundPage() {
  return <Suspense><MatchRoundContent /></Suspense>;
}
