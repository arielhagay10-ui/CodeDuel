/**
 * Shared API contract between the backend routes and the browser client.
 *
 * SHARED FILE. Track A implements these shapes; Track B consumes them.
 * Changing anything here breaks the other track, so change it only by
 * agreement between both of us, in its own commit, on `main`.
 *
 * Field names here are the wire format: routes must return exactly these
 * keys (camelCase), even though the database columns are snake_case.
 */

export type Difficulty = "easy" | "medium" | "advanced";

export type MatchStatus = "waiting" | "active" | "between_rounds" | "completed" | "cancelled";

export type RoundStatus = "pending" | "active" | "completed" | "draw";

export type ProblemFormat = "function" | "standard_input_output";

export type SubmissionVerdict =
  | "queued"
  | "running"
  | "accepted"
  | "wrong_answer"
  | "time_limit_exceeded"
  | "runtime_error"
  | "internal_error";

/** Every error response body, for any non-2xx status. */
export type ApiError = { error: string };

/**
 * Result from the caller's point of view.
 *
 * Always relative to whoever is asking, so the browser never needs to know its own
 * user id to work out whether it won.
 */
export type Outcome = "win" | "loss" | "draw";

/** An example visible to both players. Never includes a hidden test. */
export type PublicTest = {
  ordinal: number;
  /** For `function` problems this is JSON: `{"args": [...], "kwargs": {...}}`. For stdio, raw text. */
  inputData: string;
  /** For `function` problems this is JSON. For stdio, raw text. */
  expectedOutput: string;
};

/** Problem content for a round the caller is allowed to see. Hidden tests never appear here. */
export type RoundProblem = {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  format: ProblemFormat;
  /** The function the judge calls. Null for `standard_input_output` problems. */
  entrypoint: string | null;
  statementMarkdown: string;
  starterCode: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  publicTests: PublicTest[];
};

/** What one player is allowed to know about the other mid-match. */
export type OpponentSummary = {
  id: string;
  handle: string;
  /** Visible rank for this match's difficulty. Null while the opponent is still in placements. */
  rank: { tier: string; division: string | null } | null;
};

/** `GET /api/matches/[matchId]` */
export type MatchState = {
  id: string;
  status: MatchStatus;
  difficulty: Difficulty;
  opponent: OpponentSummary;
  /** Rounds in this match: 3 for easy/medium, 1 for advanced. */
  totalRounds: number;
  roundsWonByYou: number;
  roundsWonByOpponent: number;
  /** Null until the match is `completed`. */
  outcome: Outcome | null;
  /** ISO timestamp. Set while status is `waiting`. */
  lobbyEndsAt: string | null;
  /** ISO timestamp. Set while status is `between_rounds`. */
  readyWindowEndsAt: string | null;
  activeRound: { id: string; number: number } | null;
  youReady: boolean;
  opponentReady: boolean;
  /**
   * Server time when this response was generated, ISO 8601.
   * The client uses it to correct for clock skew — never trust the local clock for timers.
   */
  serverTime: string;
};

/** `GET /api/match-rounds/[roundId]` */
export type RoundState = {
  id: string;
  roundNumber: number;
  status: RoundStatus;
  /** ISO timestamp the round's timer expires. Null while the round is still `pending`. */
  endsAt: string | null;
  /** Null until the round is `active` — a pending round must not leak its problem early. */
  problem: RoundProblem | null;
  youSubmitted: boolean;
  opponentSubmitted: boolean;
  /** True only once both players submitted and both judge jobs finished. */
  revealed: boolean;
  /** Present only when `revealed` is true. */
  result: RoundResult | null;
  serverTime: string;
};

export type RoundResult = {
  outcome: Outcome;
  yourTestsPassed: number;
  opponentTestsPassed: number;
  testsTotal: number;
  yourVerdict: SubmissionVerdict;
  opponentVerdict: SubmissionVerdict;
};

/** `GET /api/match-rounds/[roundId]/draft` */
export type DraftState = {
  /** Null when the player has not typed anything yet — the client falls back to `problem.starterCode`. */
  sourceCode: string | null;
  updatedAt: string | null;
};

/** `POST /api/match-rounds/[roundId]/submissions` — 202 */
export type SubmitResult = {
  submissionId: string;
  locked: true;
};

/** `POST /api/matches/[matchId]/ready` — 202 */
export type ReadyResult = {
  ready: true;
  roundNumber: number;
};

/** `GET /api/queue` and `POST /api/queue` */
export type QueueState = {
  status: "idle" | "queued" | "matched";
  queueEntryId?: string;
  difficulty?: Difficulty;
  /** ISO timestamp. */
  queuedAt?: string;
  matchId?: string | null;
};
