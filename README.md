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

Docker (running), and Node 20+ or [Bun](https://bun.sh). Both package managers work;
`bun install` and `npm install` agree on this project.

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
```

Leave the OAuth variables unset. Local sign-in does not use them (see step 4).

### 2. Start Postgres

```bash
docker compose -f docker-compose.local.yml up -d db
```

**The migrations only run once.** `db/migrations/` is mounted into
`/docker-entrypoint-initdb.d`, and Postgres runs that directory exactly when it creates
the data directory. On an existing volume your migrations are silently skipped, including
the `009` problem seed — and an empty `problems` table makes `/api/queue` return 503
before a match can start.

Start clean with `docker compose -f docker-compose.local.yml down -v`, or apply one by
hand:

```bash
docker compose -f docker-compose.local.yml exec -T db \
  psql -U codeduel -d codeduel < db/migrations/009_seed_problems.sql
```

Confirm the seed landed — you want 14 problems:

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

**It has no button on the sign-in page yet** — `/sign-in` offers only Google and GitHub.
For now, drive it over the API and keep the cookie jar:

```bash
ORIGIN=http://localhost:3000
CSRF=$(curl -sS -c alpha.cookies -b alpha.cookies $ORIGIN/api/auth/csrf | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
curl -sS -c alpha.cookies -b alpha.cookies -H "Origin: $ORIGIN" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "handle=alpha" --data-urlencode "json=true" \
  $ORIGIN/api/auth/callback/dev
```

Repeat with a second handle and jar to get an opponent. Then queue both:

```bash
curl -sS -b alpha.cookies -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
  -d '{"difficulty":"medium"}' $ORIGIN/api/queue
```

The second player's call returns `201` with a `matchId`.

Every mutating request needs an `Origin` header. `src/proxy.ts` rejects cross-site
mutations before a route can read a session cookie, so a bare `curl -X POST` gets a 403.

### Stopping

```bash
docker compose -f docker-compose.local.yml down      # keeps your data
docker compose -f docker-compose.local.yml down -v   # also wipes the volume
```

### Checks

```bash
npx tsc --noEmit
npm run lint
npm run build
npm test                                     # proxy rate-limit / memory-bound tests

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

Every network call goes through `src/lib/api-client.ts`. Nothing else in the
browser calls `fetch`, which is what makes the flag a single switch.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
