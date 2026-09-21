# Backend foundation

## Data and matchmaking

PostgreSQL is the source of truth. The initial schema lives in `db/migrations/001_initial.sql` and separates visible rank from hidden rating data.

- Create one `user_difficulty_ratings` row per user per difficulty.
- Every row starts with five placement matches remaining.
- Queue players by difficulty and their hidden MMR/rating deviation, never by visible tier text.
- At match creation, snapshot both pre-match MMR values.
- Update rating only once the match is complete and its outcome is final.

## Secure judging boundary

The web application must not execute Python code. Submissions move through this boundary:

`Next.js API → durable job queue → isolated judge worker → database result → WebSocket match update`

The judge worker is a separate private service. For every execution it must use an ephemeral sandbox with no network, a read-only runtime, a non-root user, CPU/memory/process limits, a hard wall-clock timeout, and an isolated temporary filesystem. Hidden tests never reach the browser or the client-facing API.

Do not expose the worker directly to the internet or trust client-provided timers, test counts, or results.

## MVP worker implementation

`judge-worker/` is the private Python worker. It claims `judge_jobs` with `FOR UPDATE SKIP LOCKED`, runs each submission in an ephemeral Docker container, and persists only the verdict and aggregate hidden-test counts. Candidate source and hidden tests are mounted/streamed only within the private worker boundary.

An active round locks each player to one submission. Results are not resolved or returned to either player until both submissions exist (including expiry auto-submissions) and both jobs have completed. At timer expiry, the worker creates a submission from the player's latest persisted draft, falling back to the problem starter code.

## Rating architecture

Each completed ranked match creates exactly one immutable `rating_events` row per player. The private worker applies Glicko-2 independently for Easy, Medium, and Advanced using the stored MMR, rating deviation, and volatility. Five matches remain placements; only after the fifth event does the worker write the visible tier/division. Client-facing rating APIs return placement progress and rank labels only—never numerical MMR, deviation, or volatility.

Placement challenges use the same private judge queue. The current solo-placement UI calibrates a difficulty's Glicko-2 state against a fixed benchmark from the hidden-test result; no rating event is created because there is no opponent. After the fifth completed attempt, the visible rank is assigned.

## Moderation, presence, and forfeits

Chat endpoints permit messages only during `between_rounds`, cap bodies at 300 characters, and enforce a two-second sender rate limit. Messages and message reports are permanently purged after 90 days. Post-match player reports are private and one-per-opponent-per-match.

Clients may mark match presence as connected or disconnected. The worker forfeits a match after 60 consecutive disconnected seconds; reconnecting clears that server timestamp. Surrenders immediately complete the match, while the private worker applies the corresponding rating update exactly once.

## Production security gate

The local Compose worker uses a privileged Docker socket solely for development. It is not a production sandbox boundary. Production must run the scheduler/worker on a separately hardened, private runner host or a managed sandbox service with no access to the web host, database superuser credentials, or public network. Before launch, perform an OAuth provider integration test, database backup/restore test, adversarial judge test suite, rate-limit/load test, and independent security review.

## Load-test result

On 2026-09-21, local Docker Desktop (Linux engine 29.7.2), PostgreSQL 16, Next.js development server, and one judge worker processed 50 concurrent Easy matches using 100 distinct signed-in test users. All 100 ready-ups, draft writes, and initial submissions succeeded. The concurrent draft burst took 1.790s; the submission burst took 1.983s. These are end-to-end burst durations, not individual-request percentiles or production capacity estimates.

The initial 100 jobs completed in 78.186s from the first submission (1.28 submissions/sec); the span from first to last completion was 76.798s. Starter-code submissions deliberately exercised unsuccessful verdicts. Subsequent rounds auto-submitted on timer expiry. All 50 matches eventually completed across 300 completed jobs and exactly 100 rating events. Only the initial round used the manual concurrent submission burst; this was not a sustained autosave soak test.

An additional 20-sample sandbox benchmark measured empty-runner startup **and teardown** at mean 405.9ms, median 404.2ms, p95 436.1ms. Three trivial function tests, including that overhead, took mean 882.4ms, median 837.7ms, p95 1072.1ms. This is warm-image Docker process/container overhead, not an isolated measurement of engine startup. Run `test-support/track-c-startup.py` from `/worker` in a worker container; it always invokes `run_sandboxed`. The single worker cannot promptly clear a 100-submission burst; additional workers are a deployment capacity decision. The current rate-limit map is per web process, not a distributed quota.

## Recovery

The 2026-09-21 drill used the **disposable** `codeduel-track-c-verification` Compose project, with the actual PostgreSQL schema and private Docker judge. A custom-format dump captured an active match, two persisted drafts, one queued submission/job, and zero rating events. After deleting that project's volume and restoring into a fresh volume, the assertions verified those records. Expiring the restored round triggered auto-submission of the second draft. The restored job was accepted (3/3), the auto-submitted draft was wrong (0/3), the correct player won, and exactly one rating event was created per player. A worker restart preserved those counts. The regular local database volume was not deleted.

Use a stopped worker and paused web writes for an operational backup/restore. Let any in-flight sandbox finish first and confirm there are no `running` rows in either job table. This drill covers queued-job recovery; it does not establish automatic recovery of jobs already marked `running` after an abrupt worker crash (there is currently no lease reclaimer).

Reproduce the local drill from the repository root in PowerShell. The named project and volume below are test-only. Build the runner and worker images using `docker compose -f docker-compose.local.yml build` first. Use a fresh verification project; `seed` deliberately fails if its fixture IDs already exist.

```powershell
$stack = @('-p', 'codeduel-track-c-verification', '-f', 'test-support/compose.track-c.yml')
docker compose @stack up -d --wait db
node test-support/track-c-verify.mjs seed
if ($LASTEXITCODE -ne 0) { throw 'Fixture setup failed' }

# Binary-safe backup: avoid shell redirection of pg_dump output.
docker compose @stack exec -T db pg_dump -U codeduel -d codeduel -Fc -f /tmp/track-c-recovery.dump
if ($LASTEXITCODE -ne 0) { throw 'Backup failed' }
docker compose @stack cp db:/tmp/track-c-recovery.dump C:\CodeDuel\track-c-recovery.dump
if ($LASTEXITCODE -ne 0) { throw 'Backup copy failed' }
docker compose @stack exec -T db pg_restore --list /tmp/track-c-recovery.dump
if ($LASTEXITCODE -ne 0) { throw 'Invalid dump' }

# Destructive ONLY to this disposable verification project; retain the host dump.
docker compose @stack --profile judge down -v
if ($LASTEXITCODE -ne 0) { throw 'Test volume removal failed' }
docker compose @stack up -d --wait db
if ($LASTEXITCODE -ne 0) { throw 'Fresh database failed' }
docker compose @stack cp C:\CodeDuel\track-c-recovery.dump db:/tmp/track-c-recovery.dump
if ($LASTEXITCODE -ne 0) { throw 'Restore copy failed' }
docker compose @stack exec -T db pg_restore -U codeduel -d codeduel --clean --if-exists --exit-on-error --single-transaction /tmp/track-c-recovery.dump
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; leave worker stopped' }
node test-support/track-c-verify.mjs recovery
if ($LASTEXITCODE -ne 0) { throw 'Restored state mismatch' }
docker compose @stack --profile judge up -d judge-worker
node test-support/track-c-verify.mjs resolved
```

## Production authentication verification

`NODE_ENV=production npm run build` passed. A running production server returned 404 for GET and POST on `/api/auth/callback/dev` and `/api/auth/signin/dev`, including a valid CSRF-token POST; neither redirected nor issued a session. `/api/auth/providers` listed only Google and GitHub. The auth route explicitly blocks the dev provider in production because NextAuth otherwise returned 400 for that missing provider. `test-support/track-c-production.mjs` repeats these HTTP assertions against port 3011.

Real provider sign-in remains a launch dependency: configure a strong production `AUTH_SECRET`, Google and GitHub client IDs/secrets, `NEXTAUTH_URL` for the approved staging domain, and provider callback URLs `/api/auth/callback/google` and `/api/auth/callback/github`. Exercise both providers through the real staging sign-in flow; local provider-list checks do not replace it.

## API response privacy verification

The authenticated HTTP sweep passed 46 response assertions across every non-auth application route/method, plus session data, successful onboarding, queue operations, active/pending/completed rounds, drafts, submissions, profiles, ratings, placement creation/resumption/submission/progress, practice, presence, readiness, messages/reports, surrender, and both rematch acceptance and repeated requests. Negative checks covered anonymous practice and nonparticipant match/round/draft/chat access. The source sweep also inspected all route SQL for private-field selections.

The response scanner recursively rejects `mmr`, rating deviation, volatility, reference-solution and hidden-test/result keys. A fixture embeds unique private markers in its reference solution and hidden input/output; none appeared in HTTP responses. Public tests were limited to the two expected ordinals, pending problems were null, and results stayed null before both submissions. The separate practice queue judged exactly two public tests. The sweep found and fixed a rematch 500: the unique rematch link must be stored on one request row, not on both; both players' repeat requests now return the same match.

To repeat after the recovery drill, run a dev server against the verification DB in a separate PowerShell terminal:

```powershell
$env:DATABASE_URL='postgresql://codeduel:codeduel_local_only@localhost:55432/codeduel'
$env:NEXTAUTH_URL='http://localhost:3011'
$env:NODE_ENV='development'
npx next dev -p 3011
```

Then run `node test-support/track-c-verify.mjs sweep`. The sweep mutates only the disposable DB and is intended for one run after a fresh restore. Stop the dev server before building/running production on that port and invoking `node test-support/track-c-production.mjs`. Remove the verification project with `docker compose -p codeduel-track-c-verification -f test-support/compose.track-c.yml --profile judge down -v` when done; the host backup remains available.

Validation also passed route type generation, TypeScript, ESLint, Python compilation, and the five proxy rate-limit unit tests. On this Windows shell, the quoted glob in `npm test` discovered zero tests; the verified invocation was `$testFiles = @(rg --files src -g '*.test.ts'); node --import ./test-support/next-resolve.mjs --test @testFiles`. Generated load-test rows were removed after preserving `C:\CodeDuel\track-c-load.dump`; the mid-match recovery snapshot remains at `C:\CodeDuel\track-c-recovery.dump`. Neither backup is committed.
