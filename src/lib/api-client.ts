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
} from "@/types/api";
import { ApiRequestError } from "@/lib/api-error";

export { ApiRequestError };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(response.status, body?.error ?? "Request failed.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
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

const liveApi: MatchApi = {
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

export const api: MatchApi =
  process.env.NEXT_PUBLIC_MOCK_API === "1"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("@/lib/mock-api").mockApi as MatchApi)
    : liveApi;
