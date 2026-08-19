"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const starter = `def pair_indices(numbers, target):\n    # Return the indices of two values whose sum is target.\n    pass\n`;

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function PracticePage() {
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [running, setRunning] = useState(true);
  const [code, setCode] = useState(starter);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!running || secondsLeft === 0) return;
    const interval = window.setInterval(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearInterval(interval);
  }, [running, secondsLeft]);

  const runSample = () => {
    setResult("Sample run queued. The secure Python judge will execute this code once the judging service is connected.");
  };

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#161616]">
      <header className="border-b border-black/10 bg-white"><div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8"><Link className="text-xl font-bold tracking-[-0.06em]" href="/">CodeWars<span className="text-[#ed5b39]">.</span></Link><div className="flex items-center gap-4"><span className={`font-mono text-lg font-semibold ${secondsLeft < 60 ? "text-[#c73d25]" : ""}`}>{formatTime(secondsLeft)}</span><button onClick={() => setRunning(!running)} className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-bold">{running ? "Pause" : "Resume"}</button><button onClick={() => { setRunning(false); setSecondsLeft(600); setCode(starter); setResult(null); }} className="text-xs font-bold text-black/50 hover:text-black">Restart</button></div></div></header>
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(360px,0.9fr)_minmax(460px,1.1fr)]">
        <article className="border-b border-black/10 bg-white px-6 py-8 lg:min-h-[calc(100vh-64px)] lg:border-r lg:border-b-0 lg:px-10"><div className="max-w-xl"><div className="flex items-center gap-3"><span className="rounded-full bg-[#fbebe5] px-3 py-1 text-xs font-bold text-[#c73d25]">Medium</span><span className="text-xs font-medium text-black/45">Arrays · Hash maps</span></div><h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em]">Pair Indices</h1><p className="mt-6 leading-7 text-black/70">Given a list of integers and a target, return the indices of the two different values that add up to the target.</p><p className="mt-4 leading-7 text-black/70">You may assume exactly one valid pair exists. Return the smaller index first.</p><section className="mt-8"><h2 className="text-sm font-bold uppercase tracking-[0.14em] text-black/45">Example</h2><pre className="mt-3 overflow-x-auto rounded-xl bg-[#f4f4f1] p-4 font-mono text-sm leading-6">numbers = [2, 7, 11, 15]\ntarget = 9\n\npair_indices(numbers, target)\n# [0, 1]</pre></section><section className="mt-8"><h2 className="text-sm font-bold uppercase tracking-[0.14em] text-black/45">Constraints</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-black/65"><li>• 2 ≤ len(numbers) ≤ 100,000</li><li>• -1,000,000,000 ≤ numbers[i] ≤ 1,000,000,000</li><li>• Aim for O(n) time complexity.</li></ul></section><button className="mt-10 text-sm font-bold text-black/60 underline decoration-black/25 underline-offset-4 hover:text-black">Give up and view explanation</button></div></article>
        <section className="flex min-h-[620px] flex-col bg-[#171717] p-4 sm:p-6"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="rounded bg-[#2c2c2c] px-2.5 py-1.5 text-xs font-medium text-white">Python 3.12</span><span className="text-xs text-white/40">main.py</span></div><span className="text-xs text-white/45">Autosaved</span></div><textarea aria-label="Python code editor" value={code} onChange={(event) => setCode(event.target.value)} spellCheck="false" className="min-h-72 flex-1 resize-none rounded-xl border border-white/10 bg-[#111] p-5 font-mono text-sm leading-7 text-[#e9e9e4] outline-none focus:border-[#ed5b39]" /><div className="mt-4 rounded-xl border border-white/10 bg-[#111] p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Output</p><p className="text-xs text-white/35">Public test only</p></div><p className="mt-3 min-h-10 font-mono text-sm text-white/70">{result ?? "Run your solution to test it against the example."}</p></div><div className="mt-4 flex justify-end gap-3"><button onClick={runSample} className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-bold text-white hover:border-white/60">Run sample</button><button onClick={runSample} className="rounded-lg bg-[#ed5b39] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#d84c2b]">Submit solution</button></div></section>
      </div>
    </main>
  );
}
