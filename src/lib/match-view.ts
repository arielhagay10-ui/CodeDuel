/**
 * Presentation helpers for the match pages. Wire values in, human words out.
 */
import type {
  Difficulty,
  OpponentSummary,
  Outcome,
  PublicTest,
  RoundProblem,
  SubmissionVerdict,
} from "@/types/api";

const difficultyLabels: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  advanced: "Advanced",
};

const verdictLabels: Record<SubmissionVerdict, string> = {
  queued: "Queued",
  running: "Running",
  accepted: "Accepted",
  wrong_answer: "Wrong answer",
  time_limit_exceeded: "Time limit exceeded",
  runtime_error: "Runtime error",
  internal_error: "Judge error",
};

const outcomeLabels: Record<Outcome, string> = {
  win: "Win",
  loss: "Loss",
  draw: "Draw",
};

export const difficultyLabel = (difficulty: Difficulty) => difficultyLabels[difficulty];
export const verdictLabel = (verdict: SubmissionVerdict) => verdictLabels[verdict];
export const outcomeLabel = (outcome: Outcome) => outcomeLabels[outcome];

/** Rank is null while the opponent is still in placements. Never show a rating number. */
export const rankLabel = (rank: OpponentSummary["rank"]) =>
  rank ? [rank.tier, rank.division].filter(Boolean).join(" ") : "In placements";

export function formatClock(seconds: number | null) {
  if (seconds === null) return "--:--";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export const matchFormatLabel = (totalRounds: number) =>
  totalRounds === 1 ? "First solve" : `Best of ${totalRounds}`;

/**
 * Renders a JSON value the way Python would print it, since that is the language
 * the player is writing in and the examples sit next to their editor.
 */
function pythonic(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (Array.isArray(value)) return `[${value.map(pythonic).join(", ")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${pythonic(item)}`).join(", ")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Turns a public test into something worth reading.
 *
 * `function` problems carry their input as JSON (`{"args": [...], "kwargs": {...}}`),
 * which is correct on the wire and useless on a page, so render the call instead.
 * Anything that will not parse is shown exactly as the server sent it.
 */
export function formatExample(problem: RoundProblem, test: PublicTest) {
  if (problem.format !== "function") {
    return { call: test.inputData, output: test.expectedOutput };
  }
  try {
    const parsed = JSON.parse(test.inputData) as { args?: unknown[]; kwargs?: Record<string, unknown> };
    const args = (parsed.args ?? []).map(pythonic);
    const kwargs = Object.entries(parsed.kwargs ?? {}).map(([key, value]) => `${key}=${pythonic(value)}`);
    return {
      call: `${problem.entrypoint ?? "solution"}(${[...args, ...kwargs].join(", ")})`,
      output: safePythonic(test.expectedOutput),
    };
  } catch {
    return { call: test.inputData, output: test.expectedOutput };
  }
}

function safePythonic(json: string): string {
  try {
    return pythonic(JSON.parse(json));
  } catch {
    return json;
  }
}
