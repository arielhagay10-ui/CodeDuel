# CodeDuel

Competitive Python coding matches and focused solo practice. Two players queue at a
difficulty, get paired, solve the same timed problems, and a sandboxed judge decides the
match.

## Running the project

There are two ways to run it. Pick based on what you are working on.

| | What runs | Use it for |
| --- | --- | --- |
| **Mock mode** | Next.js only | Match UI work. No Docker, no database. |
| **Full stack** | Next.js + Postgres + judge worker | Anything touching the API, the schema, or judging. |

Mock mode is the faster loop and is documented in the next section. The rest of this
section is the full stack.

### What you need

Docker (running), and Node 24 (the verified development/test runtime). Use `npm install`
for dependencies. The Node tests use native TypeScript stripping and module hooks.

The judge worker mounts the host Docker socket so it can launch a throwaway container per
submission. That is local-development only — never expose that service.

### 1. Install and configure

```bash
npm install          # or: bun install
```

Create `.env.local` in the repo root:

```
DATABASE_URL=postgresql://codeduel:codeduel_local_only@localhost:5432/codeduel
AUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

Leave the OAuth variables unset. Local sign-in does not use them (see step 4).

### 2. Start Postgres

```bash
docker compose -f docker-compose.local.yml up -d db
```

**The migrations only run once.** `db/migrations/` is mounted into
`/docker-entrypoint-initdb.d`, and Postgres runs that directory exactly when it creates
the data directory. On an existing volume your migrations are silently skipped, including
the problem seeds — and an empty `problems` table makes `/api/queue` return 503
before a match can start.

Do not delete an existing volume to run migrations. Back it up, confirm which migrations
have already been applied, and apply missing files in order. For example, on an existing
database already through migration 010:

```bash
docker compose -f docker-compose.local.yml exec -T db \
  psql -v ON_ERROR_STOP=1 -U codeduel -d codeduel -f /docker-entrypoint-initdb.d/011_advanced_placement_problems.sql
```

Migration 010 creates the independent practice queue; 011 adds the missing Advanced
placement problems. Fresh volumes run both automatically. Confirm all seeds landed —
you want 17 problems: 6 Easy, 6 Medium, 5 Advanced:

```bash
docker compose -f docker-compose.local.yml exec -T db \
  psql -U codeduel -d codeduel -c "SELECT difficulty, count(*) FROM problems GROUP BY difficulty;"
```

### 3. Start the judge worker

```bash
docker compose -f docker-compose.local.yml up -d --build judge-worker
```

This also builds the runner image the worker launches per submission. The worker is quiet
when healthy: it logs on failure only, so no output is the good case. Check it with
`docker compose -f docker-compose.local.yml logs judge-worker`.

### 4. Start the app and sign in

```bash
npm run dev          # or: bun dev
```

[http://localhost:3000](http://localhost:3000).

If `NEXT_PUBLIC_MOCK_API=1` is still in your `.env.local` from mock mode, remove it. The
flag is read at build time, so the pages keep talking to the in-browser fake and ignore
every route you just started, with nothing in the logs to say so.

A match needs two signed-in players. Outside production there is a credentials provider
that creates a fully ranked-eligible account from a handle, so you do not need to register
OAuth apps to click through a local match.

Open `/sign-in`, enter a development handle and click **Sign in locally**. This form
exists only in development; production dev-provider requests return 404.

Use two browser profiles, or separate `localhost` and `127.0.0.1` origins, with different
handles. Two tabs on the same origin share authentication and are not two players.
Choose the same difficulty and queue both players. Both should reach the same lobby.

New real accounts go through handle selection, fair-play acceptance and five placements
per difficulty. Development accounts skip that setup for match testing.

Practice lists published database problems. Guests can edit and keep drafts on their
device; running Python requires sign-in and judges public tests only. Practice runs do
not write ranked matches, submissions, placements or ratings.

Every mutating request needs an `Origin` header. `src/proxy.ts` rejects cross-site
mutations before a route can read a session cookie, so a bare `curl -X POST` gets a 403.

### Stopping

```bash
docker compose -f docker-compose.local.yml down      # keeps your data
```

### Checks

```bash
npx next typegen
npx tsc --noEmit
npm run lint
npm run build
npm test                                     # proxy, HTTP transport and stored-run validation

# Rating tests, plus the sandbox-escape tests if the runner image is built.
docker compose -f docker-compose.judge.yml build judge-runner
python3 -m unittest discover judge-worker
```

The sandbox-escape suite in `judge-worker/test_adversarial.py` feeds the judge real
attacks — a fork bomb, a 200MB allocation, an outbound connection. They are only safe
because every one of them runs inside the runner container, where `--pids-limit`,
`--memory` and `--network none` are what actually stop them. Without the image built
those tests skip rather than fall back to your machine.

Never run `judge-worker/runner/run_tests.py` directly. Outside the container there is
no process ceiling, and the fork bomb case will take the host down with it. Everything
that judges a submission goes through `run_sandboxed` in `judge-worker/sandbox.py`.

## Working on the match UI without a database

The queue, lobby, round, and results pages can run against an in-browser fake
instead of Postgres. Put this in `.env.local`:

```
NEXT_PUBLIC_MOCK_API=1
AUTH_SECRET=<run: openssl rand -base64 32>
```

Then `npm run dev`, with no Docker and no database.

The fake lives in `src/lib/mock-api.ts`. It is a state machine on a clock rather
than a set of fixtures, so it produces the same transitions the real backend
does. The lobby resolves after 5 seconds. Rounds run a 90-second timer. The
opponent submits 8 seconds after you do. Round one is scripted as a win, round
two a loss, round three a win, so a single run reaches every branch.

Two things it does on purpose. It shifts every timestamp it returns 40 seconds
into the future, so a component reading the local clock instead of the
server-corrected one is off by a visible amount rather than a plausible one. It
also keeps its state in `sessionStorage`, so refreshing the page continues the
same match. That is how you check that a saved draft comes back.

Set `NEXT_PUBLIC_MOCK_API=0`, or drop the line, to talk to the real routes. The
bundler reads the flag at build time and drops the half you are not using, so no
mock code ships to production.

Application API calls go through `src/lib/api-client.ts` and its shared HTTP transport.
`src/lib/mock-client.ts` provides simulated practice, placement and profile responses.
Mock results do not execute Python or verify OAuth. Keep the mock flag unset for production.

## Integration and deployment status

Track D is on `track-d-client`; do not treat partial browser QA as release sign-off.
See [Track D verification](docs/TRACK-D-VERIFICATION.md) for completed checks and remaining
work. The disposable HTTP test stack runs PostgreSQL on 55432 and Next.js on 3011, separate
from the normal local database.

Production needs a separately operated PostgreSQL database and Docker judge host in
addition to the web app. Configure `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, a strong `AUTH_SECRET` and the deployed
`NEXTAUTH_URL`. Register `/api/auth/callback/google` and `/api/auth/callback/github`
under that exact origin. Real staging OAuth still needs provider credentials and a
browser test; local provider-list checks do not replace it.

Run `node test-support/track-d-production.mjs` against a production server on 3011 to
check dev-auth rejection, server-rendered sign-in controls and nonce CSP. See
[Backend operations](docs/BACKEND.md) for backups, restore limitations and load results.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
