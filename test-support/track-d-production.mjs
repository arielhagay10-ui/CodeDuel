// Server-rendered production checks; these do not replace interactive browser QA.
import assert from 'node:assert/strict';
import './track-c-production.mjs';

const response = await fetch('http://localhost:3011/sign-in');
assert.equal(response.status, 200);
const html = await response.text();
assert(html.includes('Continue with Google'));
assert(html.includes('Continue with GitHub'));
assert(!html.includes('Development handle'));
assert(!html.includes('Sign in locally'));
const csp = response.headers.get('content-security-policy');
assert(csp?.includes("'nonce-"));
assert(!csp.includes("'unsafe-eval'"));
console.log('PASS production sign-in HTML: OAuth controls present, development form absent, nonce CSP enforced');
