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
