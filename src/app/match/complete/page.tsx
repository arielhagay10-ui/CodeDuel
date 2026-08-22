"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { useMatchState } from "@/lib/hooks/use-match";
import { difficultyLabel, matchFormatLabel, rankLabel } from "@/lib/match-view";

const headlines = {
  win: "Match victory.",
  loss: "Match defeat.",
  draw: "Match drawn.",
} as const;

function MatchCompleteContent() {
  const matchId = useSearchParams().get("matchId");
  const { data: match, error } = useMatchState(matchId);

  if (!matchId) return <Shell><p className="text-sm text-black/60">This link is missing a match.</p></Shell>;
  if (!match) return <Shell><p className="text-sm text-black/60">{error ?? "Loading the final score…"}</p></Shell>;

  const handle = `@${match.opponent.handle}`;
  const summary =
    match.outcome === "draw"
      ? `You drew ${match.roundsWonByYou}–${match.roundsWonByOpponent} with ${handle}.`
      : `You ${match.outcome === "win" ? "won" : "lost"} ${match.roundsWonByYou}–${match.roundsWonByOpponent} against ${handle}.`;

  return (
    <Shell>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Ranked duel · {difficultyLabel(match.difficulty)}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">{match.outcome ? headlines[match.outcome] : "Match complete."}</h1>
      <p className="mt-2 text-sm text-black/60">{summary}</p>

      <div className="mt-8 grid grid-cols-3 border-y border-black/10 py-5 text-center">
        <div>
          <p className="text-2xl font-semibold">{match.roundsWonByYou}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-black/45">Rounds you won</p>
        </div>
        <div className="border-x border-black/10">
          <p className="text-2xl font-semibold">{match.roundsWonByOpponent}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-black/45">Rounds {handle} won</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{matchFormatLabel(match.totalRounds)}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-black/45">Format</p>
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-[#f4f4f1] p-5">
        <p className="font-semibold">{handle}</p>
        <p className="mt-1 text-sm text-black/60">{rankLabel(match.opponent.rank)} · {difficultyLabel(match.difficulty)}</p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <Link href="/" className="rounded-lg px-4 py-3 text-center text-sm font-bold text-black/60 hover:text-black">Back to dashboard</Link>
            <Link href="/match/report" className="px-3 py-3 text-sm font-bold text-black/55 underline decoration-black/20 underline-offset-4 hover:text-black">Report player</Link>
          </div>
          <Link href="/queue" className="rounded-lg bg-[#161616] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#ed5b39]">Back to the queue</Link>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]">
      <section className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgb(0_0_0_/_0.08)] sm:p-10">
        {children}
      </section>
    </main>
  );
}

export default function MatchCompletePage() {
  return <Suspense><MatchCompleteContent /></Suspense>;
}
