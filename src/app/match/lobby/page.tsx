"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ApiRequestError, api } from "@/lib/api-client";
import { useMatchState } from "@/lib/hooks/use-match";
import { difficultyLabel, formatClock, matchFormatLabel, rankLabel } from "@/lib/match-view";

function MatchLobbyContent() {
  const router = useRouter();
  const matchId = useSearchParams().get("matchId");
  const { data: match, error, refresh, secondsUntil } = useMatchState(matchId);
  const [notice, setNotice] = useState<string | null>(null);
  const [readying, setReadying] = useState(false);

  const status = match?.status ?? null;
  const activeRoundId = match?.activeRound?.id ?? null;

  // The round starting is the only exit from this page. A refresh mid-match
  // lands here with the match already active, and takes the same path out.
  useEffect(() => {
    if (!matchId || !activeRoundId || status !== "active") return;
    router.replace(`/match/round?matchId=${matchId}&roundId=${activeRoundId}`);
  }, [activeRoundId, matchId, router, status]);

  useEffect(() => {
    if (!matchId || status !== "completed") return;
    router.replace(`/match/complete?matchId=${matchId}`);
  }, [matchId, router, status]);

  async function readyUp() {
    if (!matchId) return;
    setNotice(null);
    setReadying(true);
    try {
      await api.ready(matchId);
      await refresh();
    } catch (cause) {
      setNotice(cause instanceof ApiRequestError ? cause.message : "Could not ready up.");
      setReadying(false);
    }
  }

  if (!matchId) {
    return (
      <Shell>
        <p className="text-sm text-black/60">This link is missing a match. Head back to the queue to find one.</p>
        <Link href="/queue" className="mt-6 inline-block rounded-lg bg-[#161616] px-5 py-3 text-sm font-bold text-white">Back to the queue</Link>
      </Shell>
    );
  }

  if (!match) {
    return (
      <Shell>
        <p className="text-sm text-black/60">{error ?? "Loading your match…"}</p>
        {error && <Link href="/queue" className="mt-6 inline-block rounded-lg bg-[#161616] px-5 py-3 text-sm font-bold text-white">Back to the queue</Link>}
      </Shell>
    );
  }

  const lobbySeconds = secondsUntil(match.lobbyEndsAt);

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <Link href="/queue" className="text-xl font-bold tracking-[-0.06em]">CodeDuel<span className="text-[#ed5b39]">.</span></Link>
        <span className="rounded-full bg-[#fbebe5] px-3 py-1 text-xs font-bold text-[#c73d25]">{difficultyLabel(match.difficulty)} ranked</span>
      </div>

      <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">Match found</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">Meet your opponent.</h1>

      <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-xl border border-black/10 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">You</p>
          <p className="mt-3 text-xl font-bold">{match.youReady ? "Ready" : "Not ready"}</p>
          <p className="mt-1 text-sm text-black/55">{difficultyLabel(match.difficulty)} ranked</p>
        </div>
        <p className="self-center text-center text-xs font-bold uppercase tracking-[0.18em] text-black/35">vs</p>
        <div className="rounded-xl border border-black/10 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Opponent</p>
          <p className="mt-3 text-xl font-bold">@{match.opponent.handle}</p>
          <p className="mt-1 text-sm text-black/55">{rankLabel(match.opponent.rank)}</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-[#f4f4f1] p-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-bold">Match format</p>
          <p className="font-mono text-lg font-semibold">{formatClock(lobbySeconds)}</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-black/60">
          {matchFormatLabel(match.totalRounds)}. Both players receive identical timed problems. AI, search, and outside help are prohibited.
          Round one starts when both players are ready, or when the lobby timer runs out.
        </p>
      </div>

      {notice && <p className="mt-5 rounded-lg bg-[#fff0ed] p-4 text-sm text-[#c73d25]">{notice}</p>}

      {match.youReady ? (
        <div className="mt-7 rounded-lg border border-[#a8d8bd] bg-[#e9f6ef] px-4 py-3 text-sm text-[#167149]">
          {match.opponentReady ? "Both players ready. Starting round one…" : `You are ready. Waiting for @${match.opponent.handle}…`}
        </div>
      ) : (
        <button
          onClick={() => void readyUp()}
          disabled={readying}
          className="mt-7 w-full rounded-lg bg-[#161616] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#ed5b39] disabled:opacity-60"
        >
          {readying ? "Readying up…" : "Ready up"}
        </button>
      )}

      <p className="mt-4 text-center text-xs text-black/45">
        {match.opponentReady ? `@${match.opponent.handle} is ready.` : `@${match.opponent.handle} has not readied up yet.`}
      </p>

      <Link href={`/match/surrender?matchId=${matchId}`} className="mt-5 block text-center text-xs font-bold text-black/45 hover:text-black">Surrender match</Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]">
      <section className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white p-7 shadow-[0_20px_60px_rgb(0_0_0_/_0.08)] sm:p-10">
        {children}
      </section>
    </main>
  );
}

export default function MatchLobbyPage() {
  return <Suspense><MatchLobbyContent /></Suspense>;
}
