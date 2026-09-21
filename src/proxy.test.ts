import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { proxy, rateLimitWindowCount } from "./proxy.ts";

const origin = "http://localhost:3000";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function put(pathname: string, { session = "session-a", ip = "10.0.0.1" } = {}) {
  return new NextRequest(`${origin}${pathname}`, {
    method: "PUT",
    headers: { origin, "x-forwarded-for": ip, cookie: `next-auth.session-token=${session}` },
  });
}

test("one identity hitting many distinct match URLs does not grow the map per URL", () => {
  const before = rateLimitWindowCount();
  for (let i = 0; i < 500; i += 1) proxy(put(`/api/match-rounds/${uuid(i)}/draft`));
  const added = rateLimitWindowCount() - before;
  // Keyed by route, so 500 distinct UUID paths collapse to a single window.
  assert.equal(added, 1, `expected 1 new window, got ${added}`);
});

test("the shared draft budget actually trips across distinct URLs", () => {
  let limited = 0;
  for (let i = 0; i < 200; i += 1) {
    const response = proxy(put(`/api/match-rounds/${uuid(i)}/draft`, { session: "session-b" }));
    if (response.status === 429) limited += 1;
  }
  // 60/min for drafts. Under the old per-pathname keying this was never reachable.
  assert.ok(limited > 0, "rotating the UUID bypassed the draft limit entirely");
  assert.ok(limited >= 130, `expected ~140 rejections after the 60 allowed, got ${limited}`);
});

test("unrouted /api paths cannot mint a window each", () => {
  const before = rateLimitWindowCount();
  for (let i = 0; i < 300; i += 1) proxy(put(`/api/does-not-exist-${i}`, { session: "session-c" }));
  const added = rateLimitWindowCount() - before;
  assert.equal(added, 1, `stranger minted ${added} windows from junk paths`);
});

test("expired windows are swept once the sweep interval passes", (t) => {
  t.mock.timers.enable({ apis: ["Date"] });
  t.mock.timers.setTime(1_000_000);
  for (let i = 0; i < 50; i += 1) proxy(put("/api/queue", { session: `sweep-${i}` }));
  const peak = rateLimitWindowCount();
  assert.ok(peak >= 50, `expected at least 50 windows, got ${peak}`);

  // Past the 60s window and the 30s sweep interval, then one request to drive the sweep.
  t.mock.timers.setTime(1_000_000 + 120_000);
  proxy(put("/api/queue", { session: "sweep-trigger" }));
  const after = rateLimitWindowCount();
  assert.ok(after < peak, `sweep did not evict: ${peak} -> ${after}`);
  assert.equal(after, 1, `expected only the triggering window to survive, got ${after}`);
});

test("the map is capped even when nothing has expired yet", (t) => {
  t.mock.timers.enable({ apis: ["Date"] });
  t.mock.timers.setTime(5_000_000);
  for (let i = 0; i < 20_050; i += 1) proxy(put("/api/queue", { session: `burst-${i}` }));
  const peak = rateLimitWindowCount();

  // Nothing is expired, so only the backstop can bring this down.
  t.mock.timers.setTime(5_000_000 + 31_000);
  proxy(put("/api/queue", { session: "cap-trigger" }));
  const after = rateLimitWindowCount();
  assert.ok(peak > 20_000, `expected an oversized map to trim, got ${peak}`);
  // The trim runs first, then the request that triggered it inserts its own window.
  assert.ok(after <= 20_001, `cap did not hold: ${peak} -> ${after}`);
});
