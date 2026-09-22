import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

type RateLimit = { route: string; limit: number; windowMs: number };
type RateWindow = { startedAt: number; count: number };

const minute = 60_000;
const defaultLimit: RateLimit = { route: "default", limit: 120, windowMs: minute };

/**
 * In-process rate limiting, which means this state is per server instance and resets on
 * deploy. That is fine for the budgets below — they exist to stop one client hammering
 * one box, not to enforce a global quota. A shared store is the answer if that changes.
 *
 * Two things keep the map from growing without bound, because it lives for the whole
 * process lifetime:
 *
 * - Windows are keyed by *route*, never by the raw pathname. Paths carry match and
 *   placement UUIDs, so keying on them would mint a permanent entry per round played,
 *   and `/api/<anything>` would let a stranger mint them at will.
 * - `sweep` drops windows once they expire, and caps the map as a backstop against a
 *   burst of many identities inside a single window.
 */
const rateWindows = new Map<string, RateWindow>();
const maxWindowMs = minute;
const sweepIntervalMs = 30_000;
const maxTrackedWindows = 20_000;
let lastSweptAt = 0;

/** Test seam. The size of this map is the thing that regressed, and it is otherwise unobservable. */
export const rateLimitWindowCount = () => rateWindows.size;

function limitFor(pathname: string): RateLimit {
  if (pathname === "/api/queue") return { route: "queue", limit: 10, windowMs: minute };
  if (pathname === "/api/practice/runs") return { route: "practice-runs", limit: 6, windowMs: minute };
  if (/^\/api\/(match-rounds|placements)\/[^/]+\/submissions$/.test(pathname)) return { route: "submissions", limit: 30, windowMs: minute };
  if (/^\/api\/match-rounds\/[^/]+\/draft$/.test(pathname)) return { route: "draft", limit: 60, windowMs: minute };
  return defaultLimit;
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

/** 64-bit FNV-1a. Keeps keys short and keeps raw session tokens out of a long-lived map. */
function fold(value: string) {
  let low = 2166136261;
  let high = 3221225473;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    low = Math.imul(low ^ code, 16777619);
    high = Math.imul(high ^ code, 2246822519);
  }
  return `${(low >>> 0).toString(36)}${(high >>> 0).toString(36)}`;
}

function rateLimitKey(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth/")) return `i${fold(clientIp(request))}`;
  const session = request.cookies.get("__Secure-next-auth.session-token")?.value
    ?? request.cookies.get("next-auth.session-token")?.value;
  return session ? `s${fold(session)}` : `i${fold(clientIp(request))}`;
}

function sweep(now: number) {
  // A backwards clock step (NTP correction, VM resume) would otherwise strand
  // lastSweptAt in the future and disable the sweep for good, leaking the map.
  if (now < lastSweptAt) lastSweptAt = now;
  if (now - lastSweptAt < sweepIntervalMs) return;
  lastSweptAt = now;
  for (const [key, window] of rateWindows) {
    if (now - window.startedAt >= maxWindowMs || window.startedAt > now) rateWindows.delete(key);
  }
  if (rateWindows.size <= maxTrackedWindows) return;
  // Map iterates in insertion order and `enforceRateLimit` re-inserts on every new
  // window, so the front of the map is the least recently active.
  let excess = rateWindows.size - maxTrackedWindows;
  for (const key of rateWindows.keys()) {
    rateWindows.delete(key);
    if (--excess <= 0) break;
  }
}

function enforceRateLimit(request: NextRequest) {
  // Read polling must not consume the much smaller mutation budgets.
  const policy = safeMethods.has(request.method) ? defaultLimit : limitFor(request.nextUrl.pathname);
  const now = Date.now();
  sweep(now);
  const key = `${rateLimitKey(request)}:${policy.route}`;
  const window = rateWindows.get(key);
  // `startedAt > now` means the clock moved back; treat it as a fresh window rather
  // than leaving the caller limited until real time catches up.
  if (!window || now - window.startedAt >= policy.windowMs || window.startedAt > now) {
    rateWindows.delete(key);
    rateWindows.set(key, { startedAt: now, count: 1 });
    return null;
  }
  window.count += 1;
  if (window.count <= policy.limit) return null;
  const retryAfter = Math.max(1, Math.ceil((policy.windowMs - (now - window.startedAt)) / 1000));
  const response = NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}

const isApiPath = (pathname: string) => pathname === "/api" || pathname.startsWith("/api/");

/** Reject cross-site mutations before an API route can read a session cookie. */
function guardApi(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (safeMethods.has(request.method)) return NextResponse.next();
  const origin = request.headers.get("origin");
  // Next normalizes loopback aliases in nextUrl. Host preserves the browser's
  // actual target; compare the full origin, not a cross-origin allowlist.
  const targetOrigin = new URL(`${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`).origin;
  if (!origin || origin !== targetOrigin) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  return NextResponse.next();
}

/**
 * Content Security Policy, carrying a fresh nonce on every request.
 *
 * This has to be built per-request rather than sitting in `next.config.ts`, because
 * the App Router boots hydration from inline scripts — `self.__next_f.push(...)` holds
 * the RSC payload and `self.__next_r` holds the request id. A bare `script-src 'self'`
 * blocks all of them, `self.__next_r` never gets defined, React never hydrates, and
 * every button in the app silently does nothing while the page still looks fine.
 *
 * Next reads the nonce back off the request's own CSP header while rendering and stamps
 * it onto the scripts it emits, which is why the header goes on the request as well as
 * the response. `'strict-dynamic'` then lets those trusted scripts load the chunks they
 * need, without `'unsafe-inline'` letting anything else run.
 */
function withCsp(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // React uses eval in development to rebuild server-side error stacks in the browser.
  // Neither React nor Next needs it in production.
  const scriptSrc = process.env.NODE_ENV === "development"
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export function proxy(request: NextRequest) {
  if (isApiPath(request.nextUrl.pathname)) {
    const guarded = guardApi(request);
    if (guarded.status !== 200) return guarded;
    return enforceRateLimit(request) ?? guarded;
  }
  return withCsp(request);
}

export const config = {
  matcher: [
    "/api/:path*",
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
