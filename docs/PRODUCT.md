# Product brief — CodeDuel

## Positioning

A competitive coding app for people who already know programming fundamentals. Players practice Python alone or enter ranked 1v1 matches to prove and improve their problem-solving speed.

## V1 audience and scope

- Audience: programmers beyond basic syntax; no lessons/course in v1.
- Language: Python only.
- Modes: timed solo practice and ranked 1v1.
- Tone: credible, focused competition with motivating progression—not a childish game skin.
- Question formats: function challenges and standard input/output problems. Each problem declares its format before a match begins.
- Profiles use deterministic initials/identicons generated from the player's handle. Custom avatar uploads are out of scope for v1.

## Draft competitive format

- Easy: best of three equal-difficulty questions, five minutes per round.
- Medium: best of three equal-difficulty questions, ten minutes per round.
- Advanced: first accepted solution on one hard problem, subject to validation in beta.
- Matchmaking: player chooses a difficulty queue and is paired with a nearby-rated opponent also in that queue.
- Both players see the same prompt and public examples. Evaluation uses server-side hidden tests.
- When a timer ends without an accepted answer, the player passing the most hidden tests wins the round; equal progress is a draw.
- As soon as a player solves a round, both players see its result and proceed. After the match, both can reopen unfinished questions in solo mode.
- The next round begins when both players click ready, or automatically after one minute.
- Every difficulty has an independent ladder: placement matches first, then a visible rank backed by hidden MMR. Do not show numerical MMR in the product UI.
- Ranked play prohibits AI assistance (including ChatGPT and Copilot).
- After a completed ranked match, either player may request a rematch. A rematch requires both players to opt in, creates a fresh rated match with newly selected problems, and never reuses questions from the prior match.
- If a ranked player disconnects, they have 60 seconds to reconnect. The active round timer continues during that window. Failure to return forfeits the match; a verified platform outage cancels the match without a rating update.
- A player may manually surrender a ranked match. It immediately records a forfeit and carries the same rating consequence as a disconnect forfeit.
- After a ranked match, players can privately report an opponent for suspected cheating, an inappropriate handle, or abusive behavior. Reports are queued for review; one player may submit one report against a given opponent per match.
- Match chat is available only in the between-round ready-up window, never while a problem is active. Messages are short, rate-limited, retained for moderation, and can be reported.
- During a match, opponents can see only each other's handle, rank for the selected difficulty, and current-match information. Full public profiles are available after the match ends.

## Rank ladder

Each difficulty has a separate rank and hidden MMR. A player can be Gold in Easy while still completing placements in Advanced.

| Tier | Divisions |
| --- | --- |
| Bronze | III, II, I |
| Silver | III, II, I |
| Gold | III, II, I |
| Platinum | III, II, I |
| Diamond | III, II, I |
| Master Coder | none |
| Grandmaster Coder | none |

Players complete **five placement matches** for each difficulty before receiving that difficulty's first visible rank. MMR remains server-only; rank progression is shown through wins, promotion status, and rank emblems.

## Next product decisions

1. Exact rank names, divisions, and promotion rules.
2. Exact number of placement matches per difficulty.
3. Visual identity.
4. Whether solo performance should influence recommendations only or also qualify players for ranked queues.

## Content policy

Every published question must be original, commissioned, or explicitly licensed for commercial redistribution. Record creator, license, reference solution, tests, tags, and difficulty calibration on each problem.
