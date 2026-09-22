"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ApiRequestError, api } from "@/lib/api-client";
import { useMatchState, useRoundState } from "@/lib/hooks/use-match";
import { difficultyLabel, formatClock, matchFormatLabel, verdictLabel } from "@/lib/match-view";
import type { RoundResult } from "@/types/api";

const headlines = {
  win: "You won the round.",
  loss: "You lost the round.",
  draw: "The round was a draw.",
} as const;

function MatchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get("matchId");
  const roundId = searchParams.get("roundId");

  const { data: round, error: roundError } = useRoundState(roundId);
  const { data: match, refresh, secondsUntil } = useMatchState(matchId);

  const [notice, setNotice] = useState<string | null>(null);
  const [readying, setReadying] = useState(false);

  const status = match?.status ?? null;
  // A finished round can still be the match's `activeRound` for a poll or two,
  // so only follow the pointer once it moves on to a different round.
  const nextRoundId = match?.activeRound && match.activeRound.id !== roundId ? match.activeRound.id : null;

  useEffect(() => {
    if (!matchId || !nextRoundId || status !== "active") return;
    router.replace(`/match/round?matchId=${matchId}&roundId=${nextRoundId}`);
  }, [matchId, nextRoundId, router, status]);

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

  if (!matchId || !roundId) return <Shell><p className="text-sm text-black/60">This link is missing a match or a round.</p></Shell>;
  if (!round) return <Shell><p className="text-sm text-black/60">{roundError ?? "Loading the result…"}</p></Shell>;
  if (!round.revealed || !round.result) {
    return <Shell><p className="text-sm text-black/60">Waiting for both judge runs to finish. Results appear only once both players have submitted.</p></Shell>;
  }

  const result: RoundResult = round.result;
  const readySeconds = secondsUntil(match?.readyWindowEndsAt ?? null);
  const hasNextRound = status === "between_rounds";

  return (
    <Shell>
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed5b39]">
            Ranked duel{match ? ` · ${difficultyLabel(match.difficulty)}` : ""}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">{headlines[result.outcome]}</h1>
          <p className="mt-2 text-sm text-black/55">Round {round.roundNumber}</p>
        </div>
        {match && <span className="rounded-full bg-[#f4f4f1] px-3 py-1.5 text-xs font-bold">{matchFormatLabel(match.totalRounds)}</span>}
      </div>

      <div className="mt-9 grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-y border-black/10 py-7 text-center">
        <Side
          name="You"
          initial="Y"
          dark
          testsPassed={result.yourTestsPassed}
          testsTotal={result.testsTotal}
          verdict={verdictLabel(result.yourVerdict)}
          highlight={result.outcome === "win"}
        />
        <div>
          <p className="text-4xl font-semibold tracking-tight">
            {match ? `${match.roundsWonByYou} — ${match.roundsWonByOpponent}` : "—"}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-black/40">Rounds won</p>
        </div>
        <Side
          name={match ? `@${match.opponent.handle}` : "Opponent"}
          initial={match ? match.opponent.handle.slice(0, 1).toUpperCase() : "O"}
          testsPassed={result.opponentTestsPassed}
          testsTotal={result.testsTotal}
          verdict={verdictLabel(result.opponentVerdict)}
          highlight={result.outcome === "loss"}
        />
      </div>

      <p className="mt-4 text-center text-xs leading-5 text-black/45">
        The higher hidden-test score wins the round. Both solutions were judged before either result was shown.
      </p>

      {notice && <p className="mt-6 rounded-lg bg-[#fff0ed] p-4 text-sm text-[#c73d25]">{notice}</p>}

      {hasNextRound ? (
        <div className="mt-8 rounded-xl bg-[#f4f4f1] p-5">
          <div className="flex justify-between gap-4">
            <div>
              <p className="font-semibold">Next round</p>
              <p className="mt-1 text-sm text-black/55">Starts when both players are ready, or automatically at 0:00.</p>
            </div>
            <p className="font-mono text-xl font-bold">{formatClock(readySeconds)}</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-center text-xs font-bold">
            <div className={`rounded-lg border px-3 py-3 ${match?.youReady ? "border-[#21885d] bg-[#e9f6ef] text-[#167149]" : "border-black/10 bg-white"}`}>
              {match?.youReady ? "You are ready" : "You are not ready"}
            </div>
            <div className={`rounded-lg border px-3 py-3 ${match?.opponentReady ? "border-[#21885d] bg-[#e9f6ef] text-[#167149]" : "border-black/10 bg-white text-black/50"}`}>
              {match?.opponentReady ? "Opponent is ready" : "Opponent is deciding…"}
            </div>
          </div>
          <button
            onClick={() => void readyUp()}
            disabled={readying || (match?.youReady ?? false)}
            className="mt-5 w-full rounded-lg bg-[#161616] px-5 py-3 text-sm font-bold text-white disabled:bg-[#21885d]"
          >
            {match?.youReady ? "Ready — waiting" : readying ? "Readying up…" : "Ready for the next round"}
          </button>
        </div>
      ) : (
        <p className="mt-8 rounded-xl bg-[#f4f4f1] p-5 text-sm text-black/60">Wrapping up the match…</p>
      )}

      <Link href={`/match/surrender?matchId=${matchId}`} className="mt-6 block text-center text-xs font-bold text-black/45 hover:text-black">Surrender match</Link>
    </Shell>
  );
}

function Side({ name, initial, testsPassed, testsTotal, verdict, highlight, dark = false }: {
  name: string;
  initial: string;
  testsPassed: number;
  testsTotal: number;
  verdict: string;
  highlight: boolean;
  dark?: boolean;
}) {
  return (
    <div>
      <span className={`mx-auto grid h-11 w-11 place-items-center rounded-full text-sm font-bold ${dark ? "bg-[#161616] text-white" : "bg-[#d9d8d2]"}`}>{initial}</span>
      <p className="mt-3 text-sm font-bold">{name}</p>
      <p className={`mt-2 text-sm font-bold ${highlight ? "text-[#167149]" : "text-black/65"}`}>{testsPassed} / {testsTotal} tests</p>
      <p className="mt-1 text-xs text-black/45">{verdict}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]">
      <section className="w-full max-w-3xl rounded-2xl border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgb(0_0_0_/_0.08)] sm:p-10">
        {children}
      </section>
    </main>
  );
}

export default function MatchResultsPage() {
  return <Suspense><MatchResultsContent /></Suspense>;
}
