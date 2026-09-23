import assert from "node:assert/strict";
import { test } from "node:test";
import { practiceElapsedSeconds } from "./practice-timer.ts";
const session = { id: "test", timed: true, startedAt: "2026-09-23T00:00:00Z", completedAt: null, abandonedAt: null, elapsedSeconds: 60 };
test("stopwatch counts upward from server elapsed time after refresh", () => {
  assert.equal(practiceElapsedSeconds(session, 1000, 6100), 65);
  assert.equal(practiceElapsedSeconds({ ...session, elapsedSeconds: 95 }, 6100, 6100), 95);
});
test("completion freezes at the successful submission and elapsed cannot go backwards", () => {
  assert.equal(practiceElapsedSeconds({ ...session, completedAt: "2026-09-23T00:01:00Z" }, 1000, 90000), 60);
  assert.equal(practiceElapsedSeconds(session, 1000, 500), 60);
  assert.equal(practiceElapsedSeconds({ ...session, abandonedAt: "2026-09-23T00:01:00Z" }, 1000, 90000), 60);
});
