"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type Level = "Easy" | "Medium" | "Advanced";

const problems = [
  { title: "Unique Characters", prompt: "Return True when no character appears more than once in a string.", function: "has_unique_characters(text)", starter: "def has_unique_characters(text):\n    # Write your solution here.\n    pass\n", tests: "12 hidden tests" },
  { title: "Balanced Brackets", prompt: "Return True when every opening bracket is closed in the correct order.", function: "is_balanced(text)", starter: "def is_balanced(text):\n    # Write your solution here.\n    pass\n", tests: "14 hidden tests" },
  { title: "Merge Intervals", prompt: "Merge overlapping intervals and return them sorted by start time.", function: "merge_intervals(intervals)", starter: "def merge_intervals(intervals):\n    # Write your solution here.\n    pass\n", tests: "16 hidden tests" },
  { title: "Shortest Route", prompt: "Find the shortest path length between two nodes in an unweighted graph.", function: "shortest_route(graph, start, end)", starter: "def shortest_route(graph, start, end):\n    # Write your solution here.\n    pass\n", tests: "18 hidden tests" },
  { title: "Signal Window", prompt: "Find the longest substring containing at most k distinct characters.", function: "longest_signal(text, k)", starter: "def longest_signal(text, k):\n    # Write your solution here.\n    pass\n", tests: "20 hidden tests" },
];

const limits: Record<Level, string> = { Easy: "10:00", Medium: "14:00", Advanced: "18:00" };

function PlacementChallengeContent() {
  const params = useParams<{ round: string }>();
  const searchParams = useSearchParams();
  const round = Math.min(Math.max(Number(params.round) || 1, 1), 5);
  const level = (searchParams.get("level") === "Easy" || searchParams.get("level") === "Advanced" ? searchParams.get("level") : "Medium") as Level;
  const problem = problems[round - 1];
  const [code, setCode] = useState(problem.starter);
  const [seconds, setSeconds] = useState(Number(limits[level].split(":")[0]) * 60);
  const [submitted, setSubmitted] = useState(false);
  const nextHref = useMemo(() => round < 5 ? `/onboarding/placement/${round + 1}?level=${level}` : `/onboarding/placement/results?level=${level}`, [level, round]);

  useEffect(() => {
    if (submitted || seconds === 0) return;
    const timer = window.setInterval(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [seconds, submitted]);

  const timerLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#161616]">
      <header className="border-b border-black/10 bg-white"><div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8"><Link href="/onboarding/placement" className="text-xl font-bold tracking-[-0.06em]">CodeWars<span className="text-[#ed5b39]">.</span></Link><div className="flex items-center gap-4"><span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">{level} · placement {round}/5</span><span className="font-mono text-lg font-semibold">{timerLabel}</span></div></div></header>
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(360px,.9fr)_minmax(460px,1.1fr)]"><article className="border-b border-black/10 bg-white px-6 py-8 lg:min-h-[calc(100vh-64px)] lg:border-r lg:border-b-0 lg:px-10"><span className="rounded-full bg-[#fbebe5] px-3 py-1 text-xs font-bold text-[#c73d25]">{level}</span><h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em]">{problem.title}</h1><p className="mt-6 max-w-xl leading-7 text-black/70">{problem.prompt}</p><section className="mt-9"><h2 className="text-sm font-bold uppercase tracking-[0.14em] text-black/45">Function</h2><pre className="mt-3 rounded-xl bg-[#f4f4f1] p-4 font-mono text-sm">{problem.function}</pre></section><section className="mt-8"><h2 className="text-sm font-bold uppercase tracking-[0.14em] text-black/45">Placement rules</h2><p className="mt-3 text-sm leading-6 text-black/60">Work independently. AI tools, web search, and outside help are not allowed. Your score uses correctness and time.</p></section></article>
        <section className="flex min-h-[620px] flex-col bg-[#171717] p-4 sm:p-6"><div className="mb-3 flex items-center justify-between"><span className="rounded bg-[#2c2c2c] px-2.5 py-1.5 text-xs font-medium text-white">Python 3.12</span><span className="text-xs text-white/45">{problem.tests}</span></div><textarea aria-label="Placement code editor" value={code} onChange={(event) => setCode(event.target.value)} spellCheck="false" className="min-h-72 flex-1 resize-none rounded-xl border border-white/10 bg-[#111] p-5 font-mono text-sm leading-7 text-[#e9e9e4] outline-none focus:border-[#ed5b39]" /><div className={`mt-4 rounded-xl border p-4 text-sm ${submitted ? "border-[#77c69b] bg-[#143321] text-[#bcf1d1]" : "border-white/10 bg-[#111] text-white/60"}`}>{submitted ? "Submission received. All public tests passed." : "Your solution is evaluated against public and hidden tests when submitted."}</div><div className="mt-4 flex justify-end gap-3">{submitted ? <Link href={nextHref} className="rounded-lg bg-[#ed5b39] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#d84c2b]">{round === 5 ? "Finish placement" : "Next placement"}</Link> : <button onClick={() => setSubmitted(true)} className="rounded-lg bg-[#ed5b39] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#d84c2b]">Submit solution</button>}</div></section>
      </div>
    </main>
  );
}

export default function PlacementChallengePage() {
  return <Suspense><PlacementChallengeContent /></Suspense>;
}
