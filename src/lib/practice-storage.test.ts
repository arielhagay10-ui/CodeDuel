import assert from "node:assert/strict";
import test from "node:test";
import { readPracticeRun } from "./practice-storage.ts";

const run = { id: "00000000-0000-4000-8000-000000000001", verdict: "queued", testsPassed: 0, testsTotal: 0 };
test("practice restores queued and completed runs without extra stored fields", () => {
  for (const verdict of ["queued", "running", "accepted", "wrong_answer", "runtime_error", "time_limit_exceeded", "internal_error"]) {
    const value = { ...run, verdict };
    assert.deepEqual(readPracticeRun({ getItem: () => JSON.stringify({ ...value, extra: "ignore" }) }, "key"), value);
  }
});
test("missing, corrupt, invalid or inaccessible storage does not crash practice", () => {
  for (const value of [null, "broken", "[]", "null", JSON.stringify({ ...run, id: "../other" }), JSON.stringify({ ...run, verdict: "unknown" }), JSON.stringify({ ...run, testsPassed: 2 })]) {
    assert.equal(readPracticeRun({ getItem: () => value }, "key"), null);
  }
  assert.equal(readPracticeRun({ getItem: () => { throw Error("denied"); } }, "key"), null);
});
