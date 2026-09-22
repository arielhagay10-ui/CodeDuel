# Track D integration checkpoint

Track C is merged into `main` at `cc5fec8`. Track D is on `track-d-client`;
it is **not ready to merge** until the remaining browser checks below pass.

## Implemented

- Real account-aware navigation, development sign-in, and post-login onboarding routing.
- Database-backed practice catalog, local drafts, signed-in public-test runs and result polling.
- Placement attempt/resume pages, submissions, progress and visible ranks.
- Dynamic player profiles, match-linked surrender/report screens, presence and connection warnings.
- Draft restoration protection, stale-round redirect fixes and queue recovery for both players.
- Theme toggle moved into normal document flow: the fixed toggle covered the submit button.

The original Track D ownership split assumed sufficient backend read APIs. Integration
needed additional `/api/me`, `/api/problems`, owned placement-detail and practice-result
reads. These use explicit public projections. Other bridge fixes make practice enqueue
transactional, normalize placement resume responses, return duplicate submissions as
409, and keep read polling outside mutation rate budgets. The same-origin guard uses
the actual Host because Next normalizes loopback aliases; foreign origins remain rejected.
`src/types/api.ts` and the worker are unchanged. Migration 011 adds the three missing
Advanced exercises without changing existing problems or player progress.

## Verified locally, September 21–22, 2026

Tests used the disposable `codeduel-track-d-verification` Compose project on PostgreSQL
port 55432. The regular database on port 5432 was not changed.

- Mock browser baseline: queue/lobby routing, corrected roughly 90-second timer despite
  40-second mock skew, draft refresh, and a three-round simulated match. Not a full final pass.
- Live browser: distinct `tdalpha` and `tdbravo` identities using localhost and 127.0.0.1
  cookie isolation; both reached the same Medium lobby. Readiness propagated without refresh.
- Lobby deadline started the match with only one player ready.
- Tab inserted four spaces mid-line and restored the caret. Saved draft survived refresh.
- First submission locked its editor while the opponent saw status only, not results.
- Round two used a saved draft and a deliberately shortened database deadline. Both clients
  displayed judged results, then readiness advanced both to round three.
- Both players submitted round three. On resuming authorized browser QA, both final-score
  screens displayed the same 0–0 draw, correct opponents and visible ranks, without MMR.
- A completed-match report displayed its saved confirmation. Opponent profiles showed
  real rank/history data and a match-specific report link.
- Signed-in practice displayed `Accepted · 2/2 public tests`. Signed-out practice allowed
  editing, restored the guest draft after refresh, and required sign-in to run Python.
- Surrender required confirmation and produced defeat/victory on the respective clients.
- A disposable newcomer was routed to handle selection, then fair play. Claiming a handle
  and accepting the rules led to 0/5 placement progress. An Advanced attempt displayed a
  real problem/timer, restored its local draft on refresh, submitted, displayed its judged
  result and advanced the overview to 1/5.
- A further Advanced matchup was created for connection testing, but the browser approval
  service hit a usage limit again before disconnect/recovery could be exercised. This is
  still not full D1/D7 sign-off; do not merge solely on these partial browser results.
- `node test-support/track-d-verify.mjs`: 52 successful HTTP checks, public catalog,
  two-public-test practice acceptance with no ranked writes, owned-resource isolation,
  five judged Medium placements, resume response consistency, duplicate 409 and visible rank.
- `node --import ./test-support/next-resolve.mjs --test src/proxy.test.ts`: 7 passing tests.
- `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `git diff --check`: passed.
- `NODE_ENV=production npm run build`: passed. Build workers require process-spawn permission.
- `node test-support/track-c-production.mjs`: passed; dev sign-in/callback GET and POST
  return 404 without redirects or session cookies. Google/GitHub providers remain registered.
- `node test-support/track-d-verify.mjs --advanced`: five distinct Advanced placements
  completed with all reference tests passing, followed by a visible rank. Increasing
  Subsequence, Edit Distance and Weighted Schedule each have two public and seven hidden
  tests, including maximum-size inputs. References run only inside the sandboxed judge.
  The seed migration was reapplied without duplicates. The regular database still needs 011.

### Terminal follow-up after browser approval became unavailable

- Added regression coverage for empty 201/204 responses, structured 409 errors, malformed
  error bodies, network failures and stored practice-run validation. `npm test` now runs
  correctly on Windows and passes 14 tests.
- Practice now preserves the selected problem and last run ID/result on the device,
  resumes queued-result polling on remount and clears a polling error after recovery.
  Invalid stored data is ignored. These latest UI changes still need a browser regression.
- The completion page no longer labels an active/cancelled match as a loss.
- Placement starts use a transaction-scoped lock before checking for an existing attempt.
  Five concurrent starts reused one attempt. Prototype-key difficulty values return 422.
  The updated Advanced HTTP suite passed 59 checks and all five reference solutions.
- Type generation, TypeScript, lint and the production build passed again.
- `node test-support/track-d-production.mjs` passed: OAuth controls in server-rendered
  HTML, no development form, nonce CSP without unsafe-eval, and four dev-auth 404 checks.
  Server HTML checks are not interactive browser sign-off.
- README setup now describes development sign-in, the 17-problem pool, practice auth,
  safe migration application, separate test stack and remaining deployment dependencies.

## Remaining before merge

1. Finish placement browser QA: resume an active attempt from the overview and inspect
   the final rank screen after all five attempts (five-attempt API progression already passes).
2. Exercise disconnect/recovery, duplicate ranked submission feedback, and final mock regression.
   The 409 placement API check is not a substitute for ranked UI verification.
3. Apply migration 011 to the intended local/staging database before Advanced onboarding.
   The disposable test database is updated; the regular database is deliberately untouched.
4. Recheck production sign-in interactions and the latest practice/completion changes in
   the browser. Production HTML and dev-callback 404 assertions already pass.
5. Real Google/GitHub staging OAuth still needs provider credentials and callback URLs.
6. Merge only after remaining browser checks pass; README is updated in its own commit.

## Reproduce HTTP verification

Start the existing disposable stack (never use the regular database for this test):

```powershell
docker compose -p codeduel-track-d-verification -f test-support/compose.track-c.yml --profile judge up -d --wait
$env:NODE_ENV='development'
$env:DATABASE_URL='postgresql://codeduel:codeduel_local_only@localhost:55432/codeduel'
$env:NEXTAUTH_URL='http://localhost:3011'
# NEXT_PUBLIC_MOCK_API must be unset.
npx next dev -p 3011
```

In another terminal run `node test-support/track-d-verify.mjs`. It creates uniquely named
test accounts in that disposable database. Retain the volume while resuming browser QA.

For an existing verification volume, apply the new content once (it is repeatable), then
check the Advanced references and five-problem progression:

```powershell
docker compose -p codeduel-track-d-verification -f test-support/compose.track-c.yml exec -T db psql -v ON_ERROR_STOP=1 -U codeduel -d codeduel -f /docker-entrypoint-initdb.d/011_advanced_placement_problems.sql
node test-support/track-d-verify.mjs --advanced
```

Migration mounts run automatically only for an empty PostgreSQL volume. For a non-test
database, take a backup and confirm the intended Compose project before applying 011;
do not delete its volume just to run migrations.
