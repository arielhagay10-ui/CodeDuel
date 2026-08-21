# Track A: data, API, and the judge

Your half of the split. Everything here lives in `db/`, `src/app/api/`, `src/lib/auth.ts`, and `judge-worker/`. You will not touch a single React page, and Track B will not touch a single route handler, so our branches should merge without conflicts.

## The milestone

Two people sign in, queue for a Medium match, get paired, see a real problem loaded from Postgres, submit Python, the judge runs it in a sandbox, and the database records a winner.

Nothing in the repo does this today. `problems` is empty, so `/api/queue` returns 503 before a match can even start.

Out of scope for now: practice mode, the placement flow, chat, reports, rematch, profiles, leaderboard. The schema and some routes already exist for those. Leave them alone.

## Before you start

```bash
git checkout main && git pull
git checkout -b track-a-backend
bun install          # or npm install
docker compose -f docker-compose.local.yml up -d db
```

Create `.env.local` in the repo root:

```
DATABASE_URL=postgresql://codewars:codewars_local_only@localhost:5432/codewars
AUTH_SECRET=<run: openssl rand -base64 32>
```

Leave the OAuth variables out. Step A1 replaces them for local work.

Read `docs/BACKEND.md` before writing anything. The rules about the judging boundary are not suggestions, and the one that matters most is that hidden tests must never reach the browser or any client-facing route.

### Two gotchas that will cost you an hour each

**`RouteContext` is generated, not imported.** If TypeScript says `Cannot find name 'RouteContext'`, you have not run `next dev` or `bunx next typegen` since checking out. The types come from route file scanning. This is Next 16 behaviour and it is why `AGENTS.md` warns that this is not the Next.js you remember.

**The migration mount only fires on an empty volume.** `docker-compose.local.yml` mounts `db/migrations/` into `/docker-entrypoint-initdb.d`, and Postgres runs that directory exactly once, when the data directory is created. Your new `009` file will be ignored by a database that already has data. Apply it by hand:

```bash
docker compose -f docker-compose.local.yml exec -T db \
  psql -U codewars -d codewars < db/migrations/009_seed_problems.sql
```

Or wipe and start clean with `docker compose -f docker-compose.local.yml down -v`.

## The contract

`src/types/api.ts` is on `main` already. It defines the exact JSON your routes must return. Track B's pages are typed against it and will not compile if you return a different shape.

Treat it as frozen. If you need to change a field, message me first and we change it in its own commit on `main` that we both rebase onto. A silent change to that file is the one thing that can wreck a day of the other person's work.

Note that the wire format is camelCase while the database columns are snake_case. Map explicitly in each route. Do not return raw `pg` rows.

## Who owns what

| You edit | I edit |
| --- | --- |
| `db/migrations/**` | `src/app/**/page.tsx` |
| `src/app/api/**` | `src/components/**` |
| `src/lib/auth.ts`, `src/lib/ranked-access.ts` | `src/lib/api-client.ts`, `src/lib/mock-*.ts`, `src/lib/hooks/**` |
| `judge-worker/**` | `src/app/globals.css` |

`src/types/api.ts` is shared and frozen. Nobody else's files, even for a one-line fix. Open an issue or send me a message instead.

---

## Step A1: a dev-only way to sign in

Do this first. Without it neither of us can test anything, because a 1v1 match needs two signed-in players and `src/lib/auth.ts` currently offers only Google and GitHub. Registering real OAuth apps just to click through a local match is not worth it yet.

Add a credentials provider that exists only outside production.

### What to write

In `src/lib/auth.ts`, add an import and a helper next to `ensureOAuthUser`:

```ts
import Credentials from "next-auth/providers/credentials";
```

```ts
/** Local development only. Creates a fully ranked-eligible player from a handle. */
async function ensureDevUser(handle: string) {
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE lower(handle) = lower($1)",
      [handle],
    );
    if (existing.rowCount) {
      await client.query("COMMIT");
      return existing.rows[0].id;
    }
    const userId = crypto.randomUUID();
    await client.query(
      "INSERT INTO users (id, handle, ranked_access_granted_at, fair_play_accepted_at) VALUES ($1, $2, now(), now())",
      [userId, handle],
    );
    // placement_matches_completed = 5 so the account can queue immediately.
    await client.query(
      `INSERT INTO user_difficulty_ratings (user_id, difficulty, placement_matches_completed, visible_tier, visible_division)
       VALUES ($1, 'easy', 5, 'Bronze', 'II'), ($1, 'medium', 5, 'Silver', 'II'), ($1, 'advanced', 5, 'Bronze', 'III')`,
      [userId],
    );
    await client.query("COMMIT");
    return userId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

The `placement_matches_completed = 5` is the part people miss. `/api/queue` rejects any account that has not finished placements, so a dev user without it cannot queue.

Then add the provider to `authOptions`, guarded so it can never ship:

```ts
const devProviders =
  process.env.NODE_ENV === "production"
    ? []
    : [
        Credentials({
          id: "dev",
          name: "Dev login",
          credentials: { handle: { label: "Handle", type: "text" } },
          async authorize(credentials) {
            const handle = credentials?.handle?.trim();
            if (!handle || !/^[A-Za-z0-9_]{3,24}$/.test(handle)) return null;
            const id = await ensureDevUser(handle);
            return { id, name: handle };
          },
        }),
      ];
```

Put `...devProviders` in the `providers` array.

Two callbacks need updating or the provider silently fails:

`signIn` currently returns `false` for anything that is not Google or GitHub. Let the dev provider through:

```ts
async signIn({ account, profile }) {
  if (account?.provider === "dev") return process.env.NODE_ENV !== "production";
  if (!account || (account.provider !== "google" && account.provider !== "github")) return false;
  await ensureOAuthUser(account.provider, account.providerAccountId, profile ?? {});
  return true;
},
```

`jwt` only sets `token.userId` for the two OAuth providers. Credentials passes the authorised user on the first call instead:

```ts
async jwt({ token, account, user }) {
  if (user?.id) token.userId = user.id;
  if (account && (account.provider === "google" || account.provider === "github")) {
    // ...existing lookup, unchanged
  }
  return token;
},
```

### Verify

Start `bun dev`, then in one normal window and one private window:

```
http://localhost:3000/api/auth/signin
```

Sign in as `alpha` in one and `bravo` in the other. Then in each, load `/api/ratings/me`. Both should return three difficulties with `placementsCompleted: 5`. If you get a 401, the `jwt` callback is not storing `userId`.

Separate browser profiles matter. Two tabs in one window share the session cookie and you will end up matched against yourself, which the `player_one_id <> player_two_id` check rejects.

---

## Step A2: seed real problems

Write `db/migrations/009_seed_problems.sql`.

### How many

A Medium match draws **three distinct problems**, and `/api/queue` excludes every problem the same pair has already played. Seed six or more per difficulty or your second test match will fail with `No fresh published problems are available for this matchup`. This bit me in review of the queue SQL and it will bite you at exactly the wrong moment.

Minimum useful set: 6 easy, 6 medium, 2 advanced.

### The constraints you have to satisfy

`problems_function_entrypoint_check` requires `entrypoint` to be non-null whenever `format = 'function'`. A problem is only visible to matchmaking when `published_at IS NOT NULL AND retired_at IS NULL`.

The test data format is dictated by `judge-worker/runner/run_tests.py`, not by anything in the schema:

For `format = 'function'`, `input_data` is JSON that unpacks into the call, and `expected_output` is JSON compared after `json.dumps(sort_keys=True)`:

```
input_data:      {"args": [[2, 7, 11, 15], 9]}
expected_output: [0, 1]
```

`kwargs` is supported too, as `{"args": [...], "kwargs": {"base": 10}}`.

For `format = 'standard_input_output'`, both fields are raw text and the runner compares them after `.strip()`.

Get this wrong and every submission scores zero with no useful error, because the runner catches the exception and reports `runtime_error`.

### The pattern to use

Fixed UUIDs make a seed file annoying to re-run. Use a CTE instead:

```sql
-- Seed problems for local development and the first ranked matches.
-- Every problem here must be original or licensed for commercial redistribution
-- per the content policy in docs/PRODUCT.md. Record the real author.

WITH inserted AS (
  INSERT INTO problems (
    id, slug, title, difficulty, format, entrypoint,
    statement_markdown, starter_code, reference_solution,
    time_limit_ms, memory_limit_mb, author_name, content_license, published_at
  ) VALUES (
    gen_random_uuid(),
    'pair-indices',
    'Pair Indices',
    'medium',
    'function',
    'pair_indices',
    E'Given a list of integers and a target, return the indices of the two different values that add up to the target.\n\nYou may assume exactly one valid pair exists. Return the smaller index first.\n\n## Constraints\n\n- `2 <= len(numbers) <= 100000`\n- `-10^9 <= numbers[i] <= 10^9`',
    E'def pair_indices(numbers, target):\n    # Return indices of two values whose sum is target.\n    pass\n',
    E'def pair_indices(numbers, target):\n    seen = {}\n    for index, value in enumerate(numbers):\n        if target - value in seen:\n            return [seen[target - value], index]\n        seen[value] = index\n    return []\n',
    2000, 128, 'Your Name', 'original-commissioned', now()
  ) RETURNING id
)
INSERT INTO problem_tests (id, problem_id, input_data, expected_output, is_public, weight, ordinal)
SELECT gen_random_uuid(), inserted.id, t.input_data, t.expected_output, t.is_public, 1, t.ordinal
FROM inserted, (VALUES
  ('{"args": [[2, 7, 11, 15], 9]}',        '[0, 1]',  true,  1),
  ('{"args": [[3, 3], 6]}',                '[0, 1]',  true,  2),
  ('{"args": [[-1, -2, -3, -4], -7]}',     '[2, 3]',  false, 3),
  ('{"args": [[0, 4, 3, 0], 0]}',          '[0, 3]',  false, 4),
  ('{"args": [[1000000000, -1000000000], 0]}', '[0, 1]', false, 5)
) AS t(input_data, expected_output, is_public, ordinal);
```

Repeat that block per problem. Mark two tests `is_public` on each one, because those are the examples both players see. Everything else stays hidden and never leaves the worker.

`E'...'` string literals matter. `\n` inside a plain single-quoted Postgres string is a literal backslash followed by n, and your starter code will arrive in the browser as one unbroken line.

### On the content policy

`docs/PRODUCT.md` requires every published problem to be original, commissioned, or licensed for commercial redistribution, with creator and license recorded. Do not paste LeetCode or HackerRank statements in, even for local testing, because seed data has a habit of surviving to production. Write your own statements. `content_license` should say something true.

### Verify

```bash
docker compose -f docker-compose.local.yml exec -T db \
  psql -U codewars -d codewars < db/migrations/009_seed_problems.sql

docker compose -f docker-compose.local.yml exec db psql -U codewars -d codewars -c \
  "SELECT difficulty, count(*) FROM problems WHERE published_at IS NOT NULL GROUP BY 1;"
```

Then check your reference solutions actually pass their own tests. A wrong `expected_output` looks exactly like a broken judge, and you will debug the sandbox for an hour before suspecting the data. Write a throwaway script that loads each problem, feeds `reference_solution` through the same JSON payload the worker builds in `judge-worker/worker.py:execute`, and asserts every problem scores 100%. Keep it in `judge-worker/` as `verify_seed.py`.

---

## Step A3: fill out the match state route

`GET /api/matches/[matchId]` returns most of what Track B needs but is missing four things: the opponent's handle and rank, the round counts, the outcome, and the server clock.

Rewrite it to return `MatchState` from `src/types/api.ts` exactly.

The opponent fields come from `users` joined to `user_difficulty_ratings` for this match's difficulty. `docs/PRODUCT.md` limits what one player may see mid-match to handle, rank for the selected difficulty, and current-match information. Send those and nothing else. No email, no MMR, no rating deviation. `MMR must never appear in a client-facing response` is a rule from `docs/BACKEND.md`, and `visible_tier` is null until placements finish, which is what `rank: null` means.

`serverTime` is just `now()` in the same query. Track B corrects for clock skew with it, so the timer cannot be gamed by changing the system clock. Return it from a single `now()` in the main query rather than `new Date()` in JavaScript, so it reflects the database clock the worker also uses.

`totalRounds` is `3` for easy and medium, `1` for advanced. Count it from `match_rounds` instead of hardcoding, so it stays right if the format changes.

`roundsWonByYou` and `roundsWonByOpponent` count `match_rounds` rows where `winner_id` matches. `outcome` is null unless `status = 'completed'`, then it is `win`, `loss`, or `draw` from the caller's point of view.

Keep the existing 404 when the caller is not one of the two players. That check is the entire authorisation model for this route.

### Verify

```bash
curl -s -b cookies.txt localhost:3000/api/matches/<id> | jq
```

Every key in `MatchState` should be present, `serverTime` should be within a second of now, and there should be no MMR anywhere in the output.

---

## Step A4: return problem content with the round

This is the one that unblocks the whole UI. Right now no route anywhere returns a problem statement, so even a perfectly wired page has nothing to render.

Extend `GET /api/match-rounds/[roundId]` to return `RoundState`, including the `problem` object.

I recommend putting it here rather than adding `GET /api/problems/[id]`. The round route already proves the caller is a player in that match, so you get authorisation for free and you avoid a route where someone can walk problem UUIDs and read unreleased content.

### The three rules

**Gate the problem on round status.** A match creates all three `match_rounds` rows up front, in `pending` status. If you return problem content for a pending round, a player can read round 3's problem while round 1 is still running and pre-solve it. Return `problem: null` unless the round status is `active`, `completed`, or `draw`.

**Only public tests.** Select `WHERE is_public = true`. Everything in `problem_tests` that is not public is a hidden test, and `docs/BACKEND.md` is explicit that hidden tests never reach the browser or the client-facing API. Never select `*` from that table in a route handler.

**Never send `reference_solution`.** It is a column on `problems` and it is the answer key. Name your columns explicitly in the SELECT.

### Shape of the work

One query for the round, match, and problem metadata plus `now() AS server_time`. A second for the public tests. A third for both players' submissions, giving you `youSubmitted`, `opponentSubmitted`, the verdicts, and `tests_total`.

Keep the existing reveal rule unchanged: `revealed` is true only when both players have submitted and the round has reached `completed` or `draw`, which the worker sets once both judge jobs finish. Populate `result` only when `revealed` is true, and return `null` otherwise. Do not leak a partial result while the opponent is still being judged, because that turns into a live scoreboard and changes how the match plays.

`endsAt` is null while the round is pending.

### Verify

With a match in progress, as each player:

```bash
curl -s -b alpha.txt localhost:3000/api/match-rounds/<active-round-id> | jq '.problem.publicTests | length'
curl -s -b alpha.txt localhost:3000/api/match-rounds/<pending-round-id> | jq '.problem'
```

The active round should return 2 public tests. The pending round must return `null`. Then grep the full response for a hidden test's expected output and for the reference solution, and confirm neither appears.

---

## Step A5: let a draft survive a page reload

`src/app/api/match-rounds/[roundId]/draft/route.ts` has `PUT` but no `GET`. A player who refreshes mid-round loses everything they typed, and the auto-submit at timer expiry then falls back to the untouched starter code.

Add a `GET` returning `DraftState`. Same ownership check as the `PUT`, except allow it while the round is active regardless of `ends_at`, so a player who reloads in the last second still sees their code. Return `{ sourceCode: null, updatedAt: null }` when no draft row exists yet, and Track B falls back to `problem.starterCode`.

---

## Step A6: worker fixes

Two changes in `judge-worker/worker.py`.

**Move the connection out of the loop.** `main()` currently opens a fresh Postgres connection on every iteration, roughly once a second, and closes it at the bottom. Hoist `psycopg.connect(...)` above `while True` and reconnect only on failure. This is not a micro-optimisation, it is a connection churn that will exhaust `max_connections` the moment you run more than one worker.

**Confirm the round handoff.** After round 1 completes, `update_match_after_round` should set the match to `between_rounds` with a `ready_window_ends_at`, and `advance_ready_windows` should then flip round 2 to `active`. Trace it once with logging before you trust it. If the handoff is broken the match silently stalls after round 1 and the failure looks like a frontend bug, which will cost us both time.

While you are in there, note that `advance_ready_windows` compares `match["deadline"] > now` in Python. If `deadline` is ever `NULL` that raises a `TypeError` and kills the worker loop. Add a guard.

Do not restructure the worker beyond this. The judge hardening work, including the adversarial test suite that `docs/BACKEND.md` names as a launch gate, is a separate piece of work after this milestone.

---

## Step A7: prove it end to end

Before you open a PR, run a full match yourself. You do not need the frontend for this.

1. `docker compose -f docker-compose.local.yml up -d db`
2. `docker compose -f docker-compose.local.yml up --build judge-worker`
3. `bun dev`
4. Sign in as `alpha` and `bravo` in two browser profiles, saving cookies for curl.
5. `POST /api/queue` with `{"difficulty":"medium"}` as alpha, then as bravo. The second call should return 201 with a `matchId`.
6. `POST /api/matches/<id>/ready` as both, or wait 60 seconds for the lobby timer.
7. `GET /api/match-rounds/<id>` as each player and confirm the problem arrives.
8. `POST /api/match-rounds/<id>/submissions` with a correct solution as alpha and a wrong one as bravo.
9. Watch the worker logs. Both jobs should run, then the round resolves.
10. `GET /api/match-rounds/<id>` should now show `revealed: true` with alpha's outcome as `win`.
11. Repeat for rounds 2 and 3, then confirm `matches.status = 'completed'` and that `rating_events` has exactly two rows for the match.

That last check matters. `apply_match_ratings` is written to be idempotent, and two rows rather than four is the proof.

If you get through all eleven steps, the backend half of the milestone is done.

---

## Merging

Both branches came off `main` after the contract landed, and neither of us touches the other's files, so this should be quiet.

**You merge first.** Your work has no dependency on mine, and my pages cannot be tested against anything real until your routes exist.

```bash
git checkout main && git pull
git merge --no-ff track-a-backend
git push
```

Then tell me, and I rebase, flip `NEXT_PUBLIC_MOCK_API` off, and run the integration checklist at the end of my doc.

Before you push, sanity-check the boundary one more time:

- No route returns `mmr`, `rating_deviation`, or `volatility`.
- No route returns `reference_solution`.
- No route returns a `problem_tests` row where `is_public` is false.
- `src/types/api.ts` is unchanged on your branch, or we agreed on the change.
- `.env.local` is not committed. `.gitignore` covers `.env*`, but check `git status` anyway.

The first three are worth a last grep. They are the rules in `docs/BACKEND.md` that are cheap to keep and expensive to have broken quietly for a month.
