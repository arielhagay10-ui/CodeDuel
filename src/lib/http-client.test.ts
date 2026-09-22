import assert from "node:assert/strict";
import test from "node:test";
import { request } from "./http-client.ts";
import { ApiRequestError } from "./api-error.ts";

test("empty report 201 and draft 204 responses succeed", async (t) => {
  for (const status of [201, 204]) {
    const stub = t.mock.method(globalThis, "fetch", async () => new Response(null, { status }));
    assert.equal(await request("/api/test", { method: "POST" }), undefined);
    stub.mock.restore();
  }
});

test("JSON responses and mutation options pass through without caching", async (t) => {
  let options: RequestInit | undefined;
  t.mock.method(globalThis, "fetch", async (_path: string, init?: RequestInit) => {
    options = init;
    return Response.json({ id: "run", verdict: "queued" }, { status: 202 });
  });
  assert.deepEqual(await request("/api/test", { method: "POST", body: "{}", keepalive: true }), { id: "run", verdict: "queued" });
  assert.equal(options?.cache, "no-store");
  assert.equal(options?.method, "POST");
  assert.equal(options?.keepalive, true);
  assert.equal(options?.body, "{}");
});

test("duplicate-submission 409 preserves a user-visible error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Your solution is already locked." }, { status: 409 }));
  await assert.rejects(request("/api/test"), (error: unknown) =>
    error instanceof ApiRequestError && error.status === 409 && error.message === "Your solution is already locked.");
});

test("HTML and malformed error bodies use a safe fallback", async (t) => {
  for (const body of ["<html>Unavailable</html>", '{"error":{"internal":"details"}}']) {
    const stub = t.mock.method(globalThis, "fetch", async () => new Response(body, { status: 503 }));
    await assert.rejects(request("/api/test"), (error: unknown) =>
      error instanceof ApiRequestError && error.status === 503 && error.message === "Request failed.");
    stub.mock.restore();
  }
});

test("network failure stays a failure, never a successful mutation", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Offline"); });
  await assert.rejects(request("/api/test"), /Offline/);
});
