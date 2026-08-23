# Track D: the rest of the client

Idan's half of the second split. Everything here lives in `src/app/**/page.tsx`, `src/components/`, and the client-side helpers under `src/lib/`. You will not touch a route handler, a migration, or the worker, so your branch and Ariel's should merge as quietly as A and B did.

## The milestone

Someone who has never seen CodeDuel can sign in, find out where they rank, and play — without hitting a page that is still a mockup.

The ranked match flow is wired to the real API and builds clean. Everything around it is not: `src/app/sign-in/page.tsx` has no way to sign in, `src/app/practice/page.tsx` prints "Sample run queued" and runs nothing, `src/app/players/kitebyte/page.tsx` is a hardcoded fake player, and the placement flow is five `<Link>`s to a page that does not fetch anything.

And one thing comes before all of it.

## Step D1 comes first, and it is not optional

**Nobody has ever clicked this app.** Lint, `tsc --noEmit`, and `next build` are clean. The mock state machine was driven through a full three-round match in Node with 47 assertions. The markdown renderer was checked by reading its server-rendered HTML. All of that is real, and none of it is a browser.

Ready-up, the three-second debounced autosave, Tab inserting four spaces with the caret restored, draft restore across a refresh, and the page-to-page routing have never been exercised by a human. Do D1 before you write a single new line, because every step after it assumes the foundation works, and if it does not, you want to know on day one.

## Before you start

```bash
git checkout main && git pull
git checkout -b track-d-client
bun install
```

`.env.local`:

```
NEXT_PUBLIC_MOCK_API=1
AUTH_SECRET=<run: openssl rand -base64 32>
```

```bash
bun dev
```

### Two things that will waste your afternoon

**If a page renders perfectly and every button is dead, it is CSP, not your code.** That failure mode already happened once: a static `script-src 'self'` blocked the App Router's inline hydration scripts, React never hydrated, and the page looked completely fine. It is fixed with a per-request nonce in `src/proxy.ts` — but `src/proxy.ts` is Ariel's file this round, and he is editing it for rate limiting in C4. If dead buttons come back after a rebase, that is the first place to look, and it is his fix to make.

**The mock shifts every timestamp forty seconds on purpose.** If a round timer reads about 130 seconds where it should read 90, you are trusting the local clock somewhere instead of `serverTime`. That is the tell, and it is the whole reason `useServerClock` exists.

## Who owns what

| You edit | Ariel edits |
| --- | --- |
| `src/app/**/page.tsx`, `src/app/layout.tsx` | `src/app/api/**` |
| `src/components/**` | `judge-worker/**`, `db/migrations/**` |
| `src/lib/api-client.ts`, `src/lib/mock-*.ts` | `src/lib/auth.ts`, `access.ts`, `ranked-access.ts`, `db.ts` |
| `src/lib/hooks/**`, `match-view.ts`, `match-format.ts`, `ranks.ts`, `avatar.ts` | `src/proxy.ts`, `docker-compose*.yml` |
| `src/app/globals.css`, `docs/PRODUCT.md` | `docs/BACKEND.md`, `docs/AUTH.md` |

`src/types/api.ts` is shared and still frozen after the C0 commit you both agree on.

`README.md` belongs to neither of us until the end. Whoever merges second updates it, in its own commit.

---

## Step D1: the browser pass nobody has run

Mock mode first, because it needs no database and its timings are deliberately short. Then again against the real backend once Ariel's branch lands.

Open two browser profiles — not two tabs, two profiles, or you share a session cookie and both "players" are the same person.

Walk it, and write down every defect rather than fixing as you go; a list is easier to triage than a half-finished branch:

1. `/queue` — pick Medium, join. The other profile joins. Both land in the lobby.
2. `/match/lobby` — ready up in one profile. Confirm the other profile sees it *without a refresh* — that is the polling loop doing its job.
3. Let the lobby timer run out in a second match instead of readying up. It should start anyway.
4. `/match/round` — the problem renders from real markdown, the starter code is in the editor, the timer counts down smoothly rather than jumping two seconds at a time.
5. Type. Wait three seconds. Refresh the page. **Your draft must come back.** This is the autosave and it has never been observed working.
6. Press Tab mid-line. Four spaces go in and the caret stays where you expect.
7. Submit in one profile only. That profile locks. The other must **not** see the result — reveal is gated on both submissions.
8. Submit in the other. Both reveal together.
9. Let a round expire without submitting. The saved draft gets judged, and the page does not race the worker into showing a result that is not there yet.
10. Try to submit twice. The second should be a clean 409 message, not a stack trace.
11. Play all three rounds through to `/match/complete`.
12. On every screen from step 7 onward, confirm no MMR number is anywhere on the page. Rank tier and division only.

Then repeat 1–12 with `NEXT_PUBLIC_MOCK_API` unset against a real database and a running judge worker. The whole point of the flag is that the same code takes both paths; if a step passes in mock and fails live, the bug is in the parts the mock stands in for, and that is worth telling Ariel about immediately rather than working around.

Nothing else in this doc matters if D1 turns up something structural. Finish it before deciding how the rest of the week goes.

---

## Step D2: sign-in, for people who are not holding curl

`src/app/sign-in/page.tsx` already calls `signIn("google")` and `signIn("github")` properly. Two things are missing around it.

**A dev sign-in form.** The only way anyone has ever authenticated locally is a hand-rolled curl against `/api/auth/callback/dev` carrying a CSRF token and an `Origin` header. Add a handle field and a submit button rendered **only** when `process.env.NODE_ENV === "development"`. The provider is `id: "dev"` with a single field, `handle`. It does not exist in a production build, so the form must not either.

This is what makes D1's second pass bearable. Signing in two players by curl on every test run is how you quietly stop testing.

**Routing by state instead of by constant.** Both OAuth buttons pass `redirectTo: "/onboarding/handle"`, so a returning player who has had a handle for months gets sent to claim one every single time they sign in. Send people where they actually are: no handle → `/onboarding/handle`, no fair-play acceptance → `/onboarding/fair-play`, otherwise `/queue`.

Both onboarding pages already POST to their routes and work correctly. Nothing is wrong with them except who arrives.

---

## Step D3: the dead-link audit

`src/app/page.tsx` is a static landing page with a nav bar. Click every link in the app and list the ones that go nowhere, go somewhere hardcoded, or go somewhere that assumes a match id nobody has.

Known: `/players/kitebyte` is a fabricated profile at a literal URL, and it is the only profile URL that exists. `/match/surrender` and `/match/reconnecting` have no inbound link from anywhere. `/match/report` is linked from `/match/complete` but carries no match id, so it cannot report anything.

Fix the navigation, not the destinations — the destinations are D6 and D7. What you want out of this step is that nothing visible is a lie.

---

## Step D4: practice mode, actually running code

`src/app/practice/page.tsx` has a working editor, a countdown from a literal `600`, a hardcoded "Pair Indices" problem, and a Run button whose entire behaviour is `setResult("Sample run queued...")`.

Ariel is building `POST /api/practice/runs` in C1, returning a verdict against **public tests only**. Add it to `api-client.ts` and to the mock so you can build before his branch lands — that is exactly what B1 did, and it is why the tracks worked.

Three things to keep straight:

- The problem list has to come from the database, not `mock-problems.ts`. There are fourteen seeded problems; a practice page that shows one hardcoded problem forever is not practice.
- Practice is available to guests, so guest progress lives in `localStorage` and nowhere else. `docs/AUTH.md` is absolute: never create an MMR, rank, placement, or ranked-match record for a guest session.
- The countdown is decoration here. Practice has no opponent and no server-authoritative deadline, so do not reach for `useServerClock` — a local timer is correct for once.

---

## Step D5: the placement flow

`/onboarding/placement` renders five cards from a local array and links to `/onboarding/placement/[round]?level=Medium`. It fetches nothing. Meanwhile `POST /api/placements` and `POST /api/placements/[attemptId]/submissions` have existed and worked the whole time, and Ariel is adding the `GET` in C1.

Rebuild the flow against those routes: real attempt state, five attempts per difficulty, a real problem, a real timer from `endsAt`, a real submission.

Drop `?level=` from the URL. That was the same mistake the match pages made before B — difficulty belongs in the server's response, not the query string, or a refresh can silently change which queue you are placing into.

`/onboarding/placement/results` should show the rank the five attempts produced, which means reading `/api/ratings/me`. Tier and division. No MMR, no numbers, not even "close to promotion".

---

## Step D6: a profile page for a real player

Replace `src/app/players/kitebyte/page.tsx` with `src/app/players/[handle]/page.tsx` reading `GET /api/players/[handle]` (Ariel's, C1).

`src/lib/avatar.ts` already generates a deterministic colour and initials from a handle. Use it — `docs/PRODUCT.md` puts custom avatar uploads out of scope for v1, and the identicon is the whole answer to that, not a placeholder for it.

The hardcoded page shows per-difficulty rank and the last ten matches. Keep that shape; just make it true. And check the response in the network tab rather than trusting the type: this is a page about someone else, and it is the single most likely place for a rating field to leak into the browser.

---

## Step D7: disconnects, surrender, and reports

Three pages exist as static screens, and all three have working routes behind them:

- `/match/reconnecting` — `POST /api/matches/[matchId]/presence` takes `{connected: boolean}`. Send `false` when the tab is hidden or the polling loop has failed twice in a row, `true` when it recovers. The page should be a real state of the match view, not a URL someone navigates to.
- `/match/surrender` — `POST /api/matches/[matchId]/surrender` already returns a winner and forfeits. It needs a confirmation step; it ends a ranked match and it is not undoable.
- `/match/report` — `POST /api/matches/[matchId]/reports` exists. The page is already linked from `/match/complete`, but the link carries no match id, so the form has nothing to submit against. Pass the match through, and add the same entry point to the results screen and the profile page.

Presence is the one that changes what a player experiences. The other two are ten-minute wirings.

---

## Merging

**Ariel merges first**, same as last time. Your pages cannot be tested against `/api/players/[handle]`, `/api/placements`, or `/api/practice/runs` until they exist.

Then:

```bash
git checkout main && git pull
git rebase main            # on track-d-client
# unset NEXT_PUBLIC_MOCK_API and run D1 again, live
git checkout main
git merge --no-ff track-d-client
git push
```

Before you push:

- D1's full checklist passes against the real backend, not just the mock.
- `bun run lint`, `bunx tsc --noEmit`, and `bun run build` are clean.
- No MMR, rating deviation, or volatility appears in any rendered page or any response you read in the network tab.
- `src/types/api.ts` matches the C0 commit exactly.
- No route handler, migration, or Python file appears in `git diff main --stat`. If one does, you took something that is Ariel's.

Then update `README.md` — you are merging second, so the setup instructions are yours to correct.
