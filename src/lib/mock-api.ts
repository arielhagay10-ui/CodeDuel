/**
 * An in-browser fake of the match backend, enabled by NEXT_PUBLIC_MOCK_API=1.
 *
 * It is a state machine on a clock rather than a bag of fixtures, because the
 * transitions are the part of the match flow that is hard to get right, and a
 * fake that never changes will not exercise a single one of them.
 *
 * Two deliberate details:
 *
 *  - Every timestamp it emits is shifted 40 seconds into the future, so any
 *    component that reads `Date.now()` instead of the server-corrected clock is
 *    off by a very visible 40 seconds rather than by a plausible half-second.
 *  - The state is anchored in `sessionStorage`, so a page refresh continues the
 *    same fake match instead of starting a new one. Restoring a draft after a
 *    reload is a thing you have to be able to test.
 */
import { ApiRequestError } from "@/lib/api-error";
import { mockProblems } from "@/lib/mock-problems";
import type { MatchApi } from "@/lib/api-client";
import type {
  Difficulty,
  DraftState,
  MatchState,
  MatchStatus,
  Outcome,
  QueueState,
  ReadyResult,
  RoundResult,
  RoundState,
  RoundStatus,
  SubmitResult,
} from "@/types/api";

const SERVER_SKEW_MS = 40_000;
const QUEUE_MATCH_MS = 3_000;
const LOBBY_MS = 5_000;
const ROUND_MS = 90_000;
const OPPONENT_READY_MS = 2_000;
const OPPONENT_SUBMIT_MS = 8_000;
const READY_WINDOW_MS = 60_000;
const LATENCY_MS = 150;
const STORAGE_KEY = "codeduel.mock-api.v1";

/** Round 1 is a win, round 2 a loss, round 3 a win, so every branch gets seen. */
const scriptedResults: RoundResult[] = [
  { outcome: "win", yourTestsPassed: 12, opponentTestsPassed: 7, testsTotal: 12, yourVerdict: "accepted", opponentVerdict: "wrong_answer" },
  { outcome: "loss", yourTestsPassed: 9, opponentTestsPassed: 14, testsTotal: 14, yourVerdict: "time_limit_exceeded", opponentVerdict: "accepted" },
  { outcome: "win", yourTestsPassed: 15, opponentTestsPassed: 11, testsTotal: 15, yourVerdict: "accepted", opponentVerdict: "wrong_answer" },
];

const opponent = {
  id: "99999999-9999-4999-8999-999999999999",
  handle: "GraphRunner",
  rank: { tier: "Silver", division: "II" },
};

type MockRound = {
  id: string;
  number: number;
  problemIndex: number;
  status: RoundStatus;
  endsAt: number | null;
  draft: string | null;
  draftUpdatedAt: number | null;
  yourSubmitAt: number | null;
  opponentSubmitAt: number | null;
};

type MockMatch = {
  id: string;
  difficulty: Difficulty;
  status: MatchStatus;
  /** When the current `waiting` or `between_rounds` phase began. */
  phaseStartedAt: number;
  youReady: boolean;
  roundsWonByYou: number;
  roundsWonByOpponent: number;
  outcome: Outcome | null;
  rounds: MockRound[];
};

type MockState = {
  queue: {
    status: QueueState["status"];
    entryId: string | null;
    difficulty: Difficulty | null;
    queuedAt: number | null;
  };
  match: MockMatch | null;
};

const iso = (ms: number) => new Date(ms + SERVER_SKEW_MS).toISOString();
const isoOrNull = (ms: number | null) => (ms === null ? null : iso(ms));
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS));

let state: MockState | null = null;

function emptyState(): MockState {
  return { queue: { status: "idle", entryId: null, difficulty: null, queuedAt: null }, match: null };
}

function load(): MockState {
  if (state) return state;
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) state = JSON.parse(stored) as MockState;
    } catch {
      // A blocked or corrupt sessionStorage just means a fresh match.
    }
  }
  state ??= emptyState();
  return state;
}

function save() {
  if (typeof window === "undefined" || !state) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal: the in-memory copy still drives this tab.
  }
}

function createMatch(difficulty: Difficulty, now: number): MockMatch {
  const totalRounds = difficulty === "advanced" ? 1 : 3;
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    difficulty,
    status: "waiting",
    phaseStartedAt: now,
    youReady: false,
    roundsWonByYou: 0,
    roundsWonByOpponent: 0,
    outcome: null,
    rounds: Array.from({ length: totalRounds }, (_unused, index) => ({
      id: `bbbbbbbb-bbbb-4bbb-8bbb-00000000000${index + 1}`,
      number: index + 1,
      problemIndex: index % mockProblems.length,
      status: "pending" as RoundStatus,
      endsAt: null,
      draft: null,
      draftUpdatedAt: null,
      yourSubmitAt: null,
      opponentSubmitAt: null,
    })),
  };
}

const opponentReadyAt = (match: MockMatch) => match.phaseStartedAt + OPPONENT_READY_MS;
const lobbyEndsAt = (match: MockMatch) => match.phaseStartedAt + LOBBY_MS;
const readyWindowEndsAt = (match: MockMatch) => match.phaseStartedAt + READY_WINDOW_MS;

function startRound(match: MockMatch, round: MockRound, now: number) {
  round.status = "active";
  round.endsAt = now + ROUND_MS;
  match.status = "active";
  match.youReady = false;
}

function finishRound(match: MockMatch, round: MockRound, now: number) {
  const result = scriptedResults[(round.number - 1) % scriptedResults.length];
  round.status = result.outcome === "draw" ? "draw" : "completed";
  if (result.outcome === "win") match.roundsWonByYou += 1;
  if (result.outcome === "loss") match.roundsWonByOpponent += 1;

  const next = match.rounds.find((item) => item.status === "pending");
  const needed = Math.floor(match.rounds.length / 2) + 1;
  const clinched = match.roundsWonByYou >= needed || match.roundsWonByOpponent >= needed;
  if (next && !clinched) {
    match.status = "between_rounds";
    match.phaseStartedAt = now;
    match.youReady = false;
    return;
  }
  match.status = "completed";
  match.outcome =
    match.roundsWonByYou === match.roundsWonByOpponent
      ? "draw"
      : match.roundsWonByYou > match.roundsWonByOpponent
        ? "win"
        : "loss";
}

/** Advances the whole fake world to `now`. Every read calls this first. */
function tick(now = Date.now()) {
  const current = load();

  if (current.queue.status === "queued" && current.queue.queuedAt !== null && now - current.queue.queuedAt >= QUEUE_MATCH_MS) {
    current.match = createMatch(current.queue.difficulty ?? "medium", now);
    current.queue.status = "matched";
  }

  const match = current.match;
  if (!match) return current;

  if (match.status === "waiting") {
    const bothReady = match.youReady && now >= opponentReadyAt(match);
    if (!bothReady && now < lobbyEndsAt(match)) return current;
    startRound(match, match.rounds[0], now);
  }

  if (match.status === "between_rounds") {
    const next = match.rounds.find((item) => item.status === "pending");
    const bothReady = match.youReady && now >= opponentReadyAt(match);
    if (!next) return current;
    if (!bothReady && now < readyWindowEndsAt(match)) return current;
    startRound(match, next, now);
  }

  if (match.status === "active") {
    const round = match.rounds.find((item) => item.status === "active");
    if (!round || round.endsAt === null) return current;
    // The worker auto-submits the last saved draft when the timer expires.
    if (round.yourSubmitAt === null && now >= round.endsAt) round.yourSubmitAt = round.endsAt;
    if (round.yourSubmitAt !== null && round.opponentSubmitAt === null) {
      round.opponentSubmitAt = round.yourSubmitAt + OPPONENT_SUBMIT_MS;
    }
    if (round.opponentSubmitAt !== null && now >= round.opponentSubmitAt) finishRound(match, round, now);
  }

  return current;
}

function requireMatch(matchId: string): MockMatch {
  const current = tick();
  if (!current.match || current.match.id !== matchId) {
    throw new ApiRequestError(404, "Match not found.");
  }
  return current.match;
}

function requireRound(roundId: string): { match: MockMatch; round: MockRound } {
  const current = tick();
  const round = current.match?.rounds.find((item) => item.id === roundId);
  if (!current.match || !round) throw new ApiRequestError(404, "Round not found.");
  return { match: current.match, round };
}

function toMatchState(match: MockMatch): MatchState {
  const now = Date.now();
  const active = match.rounds.find((item) => item.status === "active");
  return {
    id: match.id,
    status: match.status,
    difficulty: match.difficulty,
    opponent,
    totalRounds: match.rounds.length,
    roundsWonByYou: match.roundsWonByYou,
    roundsWonByOpponent: match.roundsWonByOpponent,
    outcome: match.outcome,
    lobbyEndsAt: match.status === "waiting" ? iso(lobbyEndsAt(match)) : null,
    readyWindowEndsAt: match.status === "between_rounds" ? iso(readyWindowEndsAt(match)) : null,
    activeRound: active ? { id: active.id, number: active.number } : null,
    youReady: match.youReady,
    opponentReady: match.status === "waiting" || match.status === "between_rounds" ? now >= opponentReadyAt(match) : false,
    serverTime: iso(now),
  };
}

function toRoundState(round: MockRound): RoundState {
  const revealed = round.status === "completed" || round.status === "draw";
  return {
    id: round.id,
    roundNumber: round.number,
    status: round.status,
    endsAt: isoOrNull(round.endsAt),
    problem: round.status === "pending" ? null : mockProblems[round.problemIndex],
    youSubmitted: round.yourSubmitAt !== null,
    opponentSubmitted: round.opponentSubmitAt !== null && Date.now() >= round.opponentSubmitAt,
    revealed,
    result: revealed ? scriptedResults[(round.number - 1) % scriptedResults.length] : null,
    serverTime: iso(Date.now()),
  };
}

function toQueueState(current: MockState): QueueState {
  return {
    status: current.queue.status,
    ...(current.queue.entryId ? { queueEntryId: current.queue.entryId } : {}),
    ...(current.queue.difficulty ? { difficulty: current.queue.difficulty } : {}),
    ...(current.queue.queuedAt !== null ? { queuedAt: iso(current.queue.queuedAt) } : {}),
    matchId: current.match?.id ?? null,
  };
}

export const mockApi: MatchApi = {
  async getQueue(): Promise<QueueState> {
    await wait();
    const current = tick();
    if (current.match?.status === "completed") return { status: "idle" };
    save();
    return toQueueState(current);
  },

  async joinQueue(difficulty: Difficulty): Promise<QueueState> {
    await wait();
    const current = tick();
    if (current.match?.status === "completed") { current.queue=emptyState().queue; current.match=null; }
    if (current.queue.status === "idle") {
      current.queue = {
        status: "queued",
        entryId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        difficulty,
        queuedAt: Date.now(),
      };
    }
    save();
    return toQueueState(current);
  },

  async leaveQueue(): Promise<void> {
    await wait();
    const current = load();
    if (current.queue.status !== "matched") {
      current.queue = { status: "idle", entryId: null, difficulty: null, queuedAt: null };
    }
    save();
  },

  async getMatch(matchId: string): Promise<MatchState> {
    await wait();
    const match = requireMatch(matchId);
    save();
    return toMatchState(match);
  },

  async getRound(roundId: string): Promise<RoundState> {
    await wait();
    const { round, match } = requireRound(roundId);
    save();
    const value=toRoundState(round);
    if(value.problem)value.problem={...value.problem,difficulty:match.difficulty};
    return value;
  },

  async getDraft(roundId: string): Promise<DraftState> {
    await wait();
    const { round } = requireRound(roundId);
    return { sourceCode: round.draft, updatedAt: isoOrNull(round.draftUpdatedAt) };
  },

  async saveDraft(roundId: string, sourceCode: string): Promise<void> {
    await wait();
    const { round } = requireRound(roundId);
    if (round.status !== "active" || round.yourSubmitAt !== null) {
      throw new ApiRequestError(404, "This active round is unavailable.");
    }
    round.draft = sourceCode;
    round.draftUpdatedAt = Date.now();
    save();
  },

  async submit(roundId: string, sourceCode: string): Promise<SubmitResult> {
    await wait();
    const { round } = requireRound(roundId);
    if (round.yourSubmitAt !== null) throw new ApiRequestError(409, "Your solution is already locked.");
    if (round.status !== "active") throw new ApiRequestError(404, "This active round is unavailable.");
    round.draft = sourceCode;
    round.draftUpdatedAt = Date.now();
    round.yourSubmitAt = Date.now();
    save();
    return { submissionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", locked: true };
  },

  async ready(matchId: string): Promise<ReadyResult> {
    await wait();
    const match = requireMatch(matchId);
    if (match.status !== "waiting" && match.status !== "between_rounds") {
      throw new ApiRequestError(409, "This match is not waiting on you.");
    }
    match.youReady = true;
    const next = match.rounds.find((item) => item.status === "pending");
    save();
    return { ready: true, roundNumber: next?.number ?? match.rounds.length };
  },

  async surrender(matchId: string): Promise<void> {
    await wait();
    const match = requireMatch(matchId);
    match.status = "completed";
    match.outcome = "loss";
    save();
  },
};
