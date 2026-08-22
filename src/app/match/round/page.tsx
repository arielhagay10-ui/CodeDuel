"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { CodeEditor } from "@/components/code-editor";
import { Markdown } from "@/components/markdown";
import { ApiRequestError, api } from "@/lib/api-client";
import { useMatchState, useRoundState } from "@/lib/hooks/use-match";
import { difficultyLabel, formatClock, formatExample, matchFormatLabel } from "@/lib/match-view";

const AUTOSAVE_MS = 3_000;

type SaveState = "idle" | "pending" | "saved" | "failed";

function MatchRoundContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get("matchId");
  const roundId = searchParams.get("roundId");

  const { data: round, error, refresh, secondsUntil } = useRoundState(roundId);
  const { data: match } = useMatchState(matchId);

  const [code, setCode] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const loadedRound = useRef<string | null>(null);

  const problem = round?.problem ?? null;
  const starterCode = problem?.starterCode ?? null;
  const locked = round?.youSubmitted ?? false;
  const secondsLeft = secondsUntil(round?.endsAt ?? null);
  const expired = secondsLeft === 0;

  // Restore the saved draft before the player can type over it. Falling back to
  // starter code only when the server has nothing keeps a slow response from
  // silently wiping work.
  useEffect(() => {
    if (!roundId || starterCode === null || loadedRound.current === roundId) return;
    loadedRound.current = roundId;
    void api
      .getDraft(roundId)
      .then((draft) => setCode(draft.sourceCode ?? starterCode))
      .catch(() => setCode(starterCode));
  }, [roundId, starterCode]);

  // The worker submits the last *saved* draft when the timer expires, so an
  // unsaved buffer at 0:00 means the player's real work is thrown away.
  useEffect(() => {
    if (saveState !== "pending" || !roundId || code === null || locked) return;
    const timer = window.setTimeout(() => {
      void api
        .saveDraft(roundId, code)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("failed"));
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [code, locked, roundId, saveState]);

  // Results stay hidden until both judge jobs finish. When they do, this page is done.
  useEffect(() => {
    if (!round?.revealed || !matchId || !roundId) return;
    router.replace(`/match/results?matchId=${matchId}&roundId=${roundId}`);
  }, [matchId, round?.revealed, roundId, router]);

  async function submit() {
    if (!roundId || code === null) return;
    setNotice(null);
    setSubmitting(true);
    try {
      await api.submit(roundId, code);
      setSaveState("saved");
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 409) {
        setNotice("Your solution is already locked.");
        await refresh();
      } else {
        setNotice(cause instanceof ApiRequestError ? cause.message : "Could not submit your solution.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!matchId || !roundId) {
    return <Notice body="This link is missing a match or a round." />;
  }
  if (!round) {
    return <Notice body={error ?? "Loading the round…"} />;
  }
  if (!problem || code === null) {
    return <Notice body="Waiting for the round to start…" />;
  }

  const opponentHandle = match ? `@${match.opponent.handle}` : "your opponent";
  const opponentStatus = round.opponentSubmitted ? "Submitted" : "Working";
  const saveLabel = { idle: "Autosaved", pending: "Saving…", saved: "Saved", failed: "Not saved" }[saveState];

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#161616]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-xl font-bold tracking-[-0.06em]">CodeDuel<span className="text-[#ed5b39]">.</span></Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">
              Round {round.roundNumber} · {difficultyLabel(problem.difficulty)}
            </span>
            <span className={`font-mono text-lg font-semibold ${secondsLeft !== null && secondsLeft < 60 ? "text-[#c73d25]" : ""}`}>
              {formatClock(secondsLeft)}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(360px,.9fr)_minmax(460px,1.1fr)]">
        <article className="border-b border-black/10 bg-white px-6 py-8 lg:min-h-[calc(100vh-64px)] lg:border-r lg:border-b-0 lg:px-10">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-[#fbebe5] px-3 py-1 text-xs font-bold text-[#c73d25]">{difficultyLabel(problem.difficulty)}</span>
            <span className="text-xs font-bold text-black/45">{match ? matchFormatLabel(match.totalRounds) : ""}</span>
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em]">{problem.title}</h1>

          <div className="mt-6">
            <Markdown source={problem.statementMarkdown} />
          </div>

          {problem.publicTests.length > 0 && (
            <section className="mt-8 max-w-xl">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-black/45">Worked examples</h2>
              {problem.publicTests.map((test) => {
                const example = formatExample(problem, test);
                return (
                  <pre key={test.ordinal} className="mt-3 overflow-x-auto rounded-xl bg-[#f4f4f1] p-4 font-mono text-sm leading-6">
                    {`${example.call}\n# ${example.output}`}
                  </pre>
                );
              })}
            </section>
          )}

          <div className="mt-8 max-w-xl rounded-xl border border-black/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{opponentHandle}</p>
                <p className="mt-1 text-xs text-black/45">Opponent status</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${round.opponentSubmitted ? "bg-[#e9f6ef] text-[#167149]" : "bg-[#f4f4f1] text-black/55"}`}>
                {opponentStatus}
              </span>
            </div>
          </div>

          <p className="mt-5 max-w-xl text-xs leading-5 text-black/45">
            Only status is shared during the round. Solutions and test results stay private until both players submit.
          </p>
        </article>

        <section className="flex min-h-[620px] flex-col bg-[#171717] p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded bg-[#2c2c2c] px-2.5 py-1.5 text-xs font-medium text-white">Python 3.12</span>
            <span className={`text-xs ${saveState === "failed" ? "text-[#f3a08c]" : "text-white/45"}`}>{saveLabel}</span>
          </div>

          <CodeEditor
            label="Match code editor"
            value={code}
            disabled={locked || expired}
            onChange={(next) => { setCode(next); setSaveState("pending"); }}
          />

          {notice && <p className="mt-4 rounded-xl border border-[#f3a08c] bg-[#3a1b13] p-4 text-sm text-[#f8d4c9]">{notice}</p>}

          <div className="mt-4 rounded-xl border border-white/10 bg-[#111] p-4 text-sm text-white/60">
            {locked ? (
              <span className="text-[#bcf1d1]">
                {round.opponentSubmitted
                  ? "Both solutions are locked. Waiting on the judge…"
                  : `Your solution is locked. Waiting for ${opponentHandle} to submit.`}
              </span>
            ) : expired ? (
              <span className="text-[#f8d4c9]">Time expired. Your saved draft was submitted for judging.</span>
            ) : (
              "Submitting locks this round. At 0:00 your last saved draft is submitted automatically."
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => void submit()}
              disabled={locked || expired || submitting}
              className="rounded-lg bg-[#ed5b39] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#d84c2b] disabled:bg-white/15 disabled:text-white/50 disabled:hover:bg-white/15"
            >
              {locked || expired ? "Waiting for the result" : submitting ? "Submitting…" : "Submit solution"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Notice({ body }: { body: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-5 text-[#161616]">
      <section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 text-center shadow-[0_20px_60px_rgb(0_0_0_/_0.08)]">
        <p className="text-sm text-black/60">{body}</p>
        <Link href="/queue" className="mt-6 inline-block text-xs font-bold text-black/45 hover:text-black">Back to the queue</Link>
      </section>
    </main>
  );
}

export default function MatchRoundPage() {
  return <Suspense><MatchRoundContent /></Suspense>;
}
