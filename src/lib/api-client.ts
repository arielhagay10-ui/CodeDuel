/**
 * The only place in the browser bundle that calls `fetch`.
 *
 * Pages talk to `api`, never to a URL. That keeps the mock and the live backend
 * interchangeable behind one flag, and it means a change to a route path is a
 * change to this file rather than a hunt through every page.
 */
import type {
  ApiError,
  Difficulty,
  DraftState,
  MatchState,
  QueueState,
  ReadyResult,
  RoundState,
  SubmitResult,
  PlacementState, PlayerProfile, PracticeRun, RatingsSummary, RoundProblem,
} from "@/types/api";
import type { AccountState, PlacementAttempt } from "@/lib/client-contracts";
import { ApiRequestError } from "@/lib/api-error";

export { ApiRequestError };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(response.status, body?.error ?? "Request failed.");
  }
  if (response.status === 204) return undefined as T;
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export type MatchApi = {
  getQueue(): Promise<QueueState>;
  joinQueue(difficulty: Difficulty): Promise<QueueState>;
  leaveQueue(): Promise<void>;
  getMatch(matchId: string): Promise<MatchState>;
  getRound(roundId: string): Promise<RoundState>;
  getDraft(roundId: string): Promise<DraftState>;
  saveDraft(roundId: string, sourceCode: string): Promise<void>;
  submit(roundId: string, sourceCode: string): Promise<SubmitResult>;
  ready(matchId: string): Promise<ReadyResult>;
  surrender(matchId: string): Promise<void>;
};

export type ClientExtras = {
  claimHandle(handle: string): Promise<void>;
  acceptFairPlay(): Promise<void>;
  getMe(): Promise<AccountState>;
  getProblems(): Promise<{ problems: RoundProblem[] }>;
  getProfile(handle: string): Promise<PlayerProfile>;
  getRatings(): Promise<RatingsSummary>;
  getPlacements(): Promise<PlacementState>;
  startPlacement(difficulty: Difficulty): Promise<{ attempt: { id: string } }>;
  getPlacement(id: string): Promise<PlacementAttempt>;
  submitPlacement(id: string, sourceCode: string): Promise<SubmitResult>;
  runPractice(problemSlug: string, sourceCode: string): Promise<PracticeRun>;
  getPractice(id: string): Promise<PracticeRun>;
  presence(id: string, connected: boolean): Promise<{ connected: boolean }>;
  report(id: string, category: string, details: string): Promise<void>;
};

const liveApi: MatchApi & ClientExtras = {
  claimHandle: handle => request("/api/onboarding/handle", json({ handle })),
  acceptFairPlay: () => request("/api/onboarding/fair-play", json({})),
  getMe: () => request("/api/me"),
  getProblems: () => request("/api/problems"),
  getProfile: handle => request(`/api/players/${encodeURIComponent(handle)}`),
  getRatings: () => request("/api/ratings/me"),
  getPlacements: () => request("/api/placements"),
  startPlacement: difficulty => request("/api/placements", json({ difficulty })),
  getPlacement: id => request(`/api/placements/${encodeURIComponent(id)}`),
  submitPlacement: (id, sourceCode) => request(`/api/placements/${encodeURIComponent(id)}/submissions`, json({ sourceCode })),
  runPractice: (problemSlug, sourceCode) => request("/api/practice/runs", json({ problemSlug, sourceCode })),
  getPractice: id => request(`/api/practice/runs/${encodeURIComponent(id)}`),
  presence: (id, connected) => request(`/api/matches/${id}/presence`, { ...json({ connected }), keepalive: true }),
  report: (id, category, details) => request(`/api/matches/${id}/reports`, json({ category, details })),
  getQueue: () => request(`/api/queue`),
  joinQueue: (difficulty) => request(`/api/queue`, json({ difficulty })),
  leaveQueue: () => request(`/api/queue`, { method: "DELETE" }),
  getMatch: (matchId) => request(`/api/matches/${matchId}`),
  getRound: (roundId) => request(`/api/match-rounds/${roundId}`),
  getDraft: (roundId) => request(`/api/match-rounds/${roundId}/draft`),
  saveDraft: (roundId, sourceCode) =>
    request(`/api/match-rounds/${roundId}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceCode }),
    }),
  submit: (roundId, sourceCode) =>
    request(`/api/match-rounds/${roundId}/submissions`, json({ sourceCode })),
  ready: (matchId) => request(`/api/matches/${matchId}/ready`, json({})),
  surrender: (matchId) => request(`/api/matches/${matchId}/surrender`, json({})),
};

export const api: MatchApi & ClientExtras =
  process.env.NEXT_PUBLIC_MOCK_API === "1"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      ({ ...require("@/lib/mock-api").mockApi, ...require("@/lib/mock-client").mockClient } as MatchApi & ClientExtras)
    : liveApi;
