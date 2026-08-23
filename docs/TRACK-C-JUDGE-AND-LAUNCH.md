# Track C: the judge, the API surface, and the launch gates

Ariel's half of the second split. Everything here lives in `judge-worker/`, `db/`, `src/app/api/`, `src/proxy.ts`, and the server-side helpers in `src/lib/`. You will not touch a React page, and Track D will not touch a route handler or the worker, so the branches should merge as quietly as A and B did.

## The milestone

The ranked match loop works. What is missing is everything that stands between "it works on my laptop" and "strangers can use it": a judge that cannot be cheated, routes that survive being hammered, real OAuth, and a database you can restore.

`docs/BACKEND.md` names five launch gates. None of them have been done. Four of them are yours.

Out of scope for you: any `page.tsx`, any component, the mock API, chat, and moderation. The schema and some routes exist for chat and reports. Leave them.

## Before you start

```bash
git checkout main && git pull
git checkout -b track-c-judge
bun install
docker compose -f docker-compose.local.yml up -d db
docker compose -f docker-compose.local.yml up -d --build judge-worker
```

`.env.local` as in the README. Read `docs/BACKEND.md` and `docs/AUTH.md` first — both name gates you are about to close, and the wording of the gate is the acceptance criterion.

### The gotcha that will cost you an hour

Same one as last time, and it will get you again: the migration mount only fires on an empty volume. Anything you add under `db/migrations/` is invisible to a database that already has data. Apply it by hand or `down -v`.

## Who owns what

| You edit | Idan edits |
| --- | --- |
| `judge-worker/**` | `src/app/**/page.tsx`, `src/app/layout.tsx` |
| `db/migrations/**` | `src/components/**` |
| `src/app/api/**` | `src/lib/api-client.ts`, `src/lib/mock-*.ts` |
| `src/lib/auth.ts`, `access.ts`, `ranked-access.ts`, `db.ts` | `src/lib/hooks/**`, `match-view.ts`, `match-format.ts`, `ranks.ts`, `avatar.ts` |
| `src/proxy.ts` | `src/app/globals.css` |
| `docker-compose*.yml`, `docs/BACKEND.md`, `docs/AUTH.md` | `docs/PRODUCT.md` |

`src/types/api.ts` is shared and still frozen. Step C0 is the one commit where it changes.

`README.md` belongs to neither of us until the end. Whoever merges second updates it, in its own commit.

---

## Step C0: land the contract additions (both of us, before either branch starts)

Track D needs three response shapes that do not exist yet, and it cannot build against a fiction. Sit down together for twenty minutes, agree the shapes, and push them to `main` in one commit that you both branch from. That is the whole reason A and B merged cleanly.

What is needed:

- `PlayerProfile` for `GET /api/players/[handle]` — handle, per-difficulty visible rank, recent match summaries. No MMR, ever.
- `RatingsSummary` for `GET /api/ratings/me` — the route exists and returns this shape informally today. Write the type to match what it already returns.
- `PlacementState` for `GET /api/placements` — current attempt, how many of five are done, per difficulty.
- `PracticeRun` for `POST /api/practice/runs` — a verdict against **public tests only**. Reuse `SubmissionVerdict`; do not invent a second verdict union.

The practice shape needs a decision from both of you before you type it, because `docs/AUTH.md` says guests may use practice, and guest-accessible code execution is anonymous compute for anyone who finds the endpoint. Either practice requires sign-in, or it is the most aggressively rate-limited route in the app. Pick one now — retrofitting it after the page ships is worse.

After this commit, `src/types/api.ts` is frozen again.

---

## Step C1: the routes Track D is blocked on

Small, and first, because it unblocks the other branch. Two new route files:

**`GET /api/players/[handle]`** — public-ish profile. Anyone signed in can read it. It returns `PlayerProfile`. The whole risk here is one query away from leaking rank internals, so build the response field by field from named columns and never spread a row.

**`GET /api/placements`** — the read side of a flow that currently only has `POST`. `src/app/api/placements/route.ts` already has the POST that creates or resumes an attempt; add the GET that lets a page render the flow without creating anything. The existing POST is your model for the access rules.

**`POST /api/practice/runs`** — takes a problem slug and source code, enqueues a judge job against the **public** tests, returns a `PracticeRun`. It writes nothing to `submissions`, `matches`, or any rating table; `docs/AUTH.md` is absolute that a guest session never produces an MMR, rank, placement, or match record. The judge path is the same one the match flow uses, so this is mostly a narrower job payload, not new machinery.

Both match routes go through `requireRankedUser`; the profile read only needs `requireUserId`; practice follows whatever you decided in C0.

---

## Step C2: the adversarial judge test suite

This is the launch gate that matters most, and there are already two holes worth finding before you write anything else.

`judge-worker/runner/run_tests.py` executes the submitted function **in the same Python process that holds the hidden tests and the comparison logic**. Look at `function_test`: `test` is a local in the calling frame, `payload` is a local in `main`, and `normalize` is a module global. A submission that gets called as `target(*args)` can reach all three:

```python
# Reads the answer instead of computing it.
import sys, json
def solve(*args, **kwargs):
    return json.loads(sys._getframe(1).f_locals["test"]["expected_output"])
```

```python
# Or skip the answer entirely and break the comparison.
import __main__
__main__.normalize = lambda value: 0
def solve(*args, **kwargs):
    return None
```

Either one passes every hidden test on every problem. Verify both against the real runner before you change anything — a test that fails for the reason you predicted is worth more than a fix you assumed you needed. Then fix the shape of it: the process that runs untrusted code must receive **inputs only**, hand back **outputs only**, and never hold the expected values or the comparator. `stdio_test` already has this property, which is why it is not exploitable; `function_test` needs to become a subprocess with the same boundary.

Then write `judge-worker/test_adversarial.py` next to the existing `test_rating.py`, one case per attack, each asserting a specific verdict rather than "did not crash":

| Attack | Expected |
| --- | --- |
| Reads `expected_output` off a parent frame | `wrong_answer` |
| Rebinds `normalize` / patches `__main__` | `wrong_answer` |
| `sys.exit(0)` or `os._exit(0)` at import | terminal verdict, never a hung job |
| `while True: pass` | `time_limit_exceeded` |
| `time.sleep(600)` — burns no CPU, so `RLIMIT_CPU` never fires | `time_limit_exceeded` |
| `open("/etc/passwd")`, writes outside `/tmp` | `runtime_error`, container unharmed |
| `socket.connect` to anything | `runtime_error` (network is `none`) |
| Fork bomb | terminal verdict; `--pids-limit 32` holds |
| 200MB allocation | `runtime_error` (memory capped at 128m) |
| Prints 100MB to stdout | terminal verdict, worker does not OOM reading it |

The last one is not paranoia. The worker reads the runner's stdout into memory with no cap.

---

## Step C3: a failed judge job must not hang the match

Related to C2 and easy to miss. `execute()` in `worker.py` raises `RuntimeError` when the runner exits non-zero or prints non-JSON. Follow that exception and answer one question: **what happens to the round?**

If the answer is that the job is marked failed and the round sits there forever, then any submission that crashes the runner is a way to freeze your opponent's match. `internal_error` is already in the `SubmissionVerdict` union in the contract, which suggests this was intended and never wired.

Make every job reach a terminal state, and make `resolve_round_if_ready` treat `internal_error` as a completed submission that lost. A player whose code broke the judge does not win the round, but the round does resolve.

Prove it by feeding the queue a submission that prints nothing and watching the match still complete.

---

## Step C4: rate limits, then a load test

`src/proxy.ts` guards cross-site origins and nothing else. There is no rate limit anywhere in the app. Count the exposed writes: queue join, ready, submissions, and a draft `PUT` that Track D fires every three seconds per player.

Add limiting in `proxy.ts` — per session for authenticated routes, per IP for `/api/auth/*`. Keep it in one place; scattering it into route handlers is how one gets forgotten.

Suggested starting budgets, tune once you have numbers: queue 10/min, submissions 30/min, drafts 60/min, practice runs 6/min, everything else 120/min. Practice is the tightest because it is the one route that may run code for someone who never signed in. Return 429 with the `ApiError` shape, because Track D's `api-client.ts` renders `body.error` for any non-2xx and a bare 429 would show "Request failed."

Then the load test the gate actually asks for: 50 concurrent matches, judged. That is 100 simultaneous drafts autosaving plus 100 submissions arriving in a burst. What you are looking for is whether the single judge worker keeps up, and how much of the delay is Docker container startup per submission. If it does not keep up, say so in `docs/BACKEND.md` with the measured number — the fix is more workers and that is a deployment decision, not a code change.

---

## Step C5: OAuth, for real

`docs/AUTH.md` is explicit about what "tested" means: production `AUTH_SECRET`, Google credentials, GitHub credentials, production callback URLs, both providers exercised.

Do it against a staging domain, not localhost. Two things to confirm beyond "the button works":

- The dev credentials provider is genuinely absent from a production build. It is guarded by an environment check today; build with `NODE_ENV=production` and confirm `/api/auth/callback/dev` 404s rather than trusting the guard by reading it.
- A first-time OAuth sign-in lands in the onboarding flow and cannot reach `/api/queue` until a handle is claimed and fair play is accepted. `requireRankedUser` is what enforces this; verify it with a real fresh account, not a hand-inserted row.

---

## Step C6: back up the database, then restore it

The gate is a restore, not a backup. A backup nobody has restored is a hope.

`pg_dump` the local database mid-match, drop the volume, restore into a fresh one, and confirm the match still resolves — the judge queue, drafts, and `rating_events` all have to come back consistent. Write the two commands into `docs/BACKEND.md` under a "Recovery" heading so the next person does not have to invent them at 3am.

---

## Step C7: the boundary sweep, widened

A4 verified the security boundary on the match routes only. Nothing has ever checked the routes that were out of scope at the time, and several of them touch `user_difficulty_ratings` directly: placements, rematch, `ratings/me`, presence, messages.

Grep every route for `mmr`, `rating_deviation`, `volatility`, `reference_solution`, and any select that could pull a `problem_tests` row with `is_public = false`. Then confirm by response, not by reading — hit each route with curl and read the JSON.

This is thirty minutes and it is the one thing on this list that gets quietly worse the longer it waits.

---

## Merging

**You merge first**, same as last time. Track D's pages cannot be tested against `/api/players/[handle]` until it exists.

```bash
git checkout main && git pull
git merge --no-ff track-c-judge
git push
```

Before you push:

- Every case in `test_adversarial.py` passes, including the two exploits reproduced in C2.
- No route returns `mmr`, `rating_deviation`, `volatility`, or `reference_solution`.
- `src/types/api.ts` matches the C0 commit exactly.
- No `page.tsx` or component appears in `git diff main --stat`. If one does, you took something that is Idan's.
