import assert from "node:assert/strict";

const base = "http://localhost:3011";
const response = await fetch(`${base}/api/auth/providers`);
assert.equal(response.status, 200);
assert.deepEqual(Object.keys(await response.json()).sort(), ["github", "google"]);
const csrfResponse = await fetch(`${base}/api/auth/csrf`);
assert.equal(csrfResponse.status, 200);
const { csrfToken } = await csrfResponse.json();
const cookie = csrfResponse.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");

for (const path of ["/api/auth/callback/dev", "/api/auth/signin/dev"]) {
  for (const method of ["GET", "POST"]) {
    const result = await fetch(base + path, {
      method,
      redirect: "manual",
      headers: { origin: base, cookie, "content-type": "application/x-www-form-urlencoded" },
      ...(method === "POST" ? {
        body: new URLSearchParams({ csrfToken, handle: "tcverify1", callbackUrl: base, json: "true" }),
      } : {}),
    });
    assert.equal(result.status, 404, `${method} ${path}`);
    assert.equal(result.headers.get("location"), null);
    assert(!result.headers.getSetCookie().some(value => value.includes("session-token")));
    console.log(`${method} ${path}: 404, no redirect or session`);
  }
}
console.log("PASS production dev auth disabled; Google/GitHub providers present.");
