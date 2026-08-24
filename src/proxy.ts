import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

type RateLimit = { limit: number; windowMs: number };
type RateWindow = { startedAt: number; count: number };

const minute = 60_000;
const rateWindows = new Map<string, RateWindow>();
const defaultLimit: RateLimit = { limit: 120, windowMs: minute };

function limitFor(pathname: string): RateLimit {
  if (pathname === "/api/queue") return { limit: 10, windowMs: minute };
  if (pathname === "/api/practice/runs") return { limit: 6, windowMs: minute };
  if (/^\/api\/(match-rounds|placements)\/[^/]+\/submissions$/.test(pathname)) return { limit: 30, windowMs: minute };
  if (/^\/api\/match-rounds\/[^/]+\/draft$/.test(pathname)) return { limit: 60, windowMs: minute };
  return defaultLimit;
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

function rateLimitKey(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth/")) return `ip:${clientIp(request)}`;
  const session = request.cookies.get("__Secure-next-auth.session-token")?.value
    ?? request.cookies.get("next-auth.session-token")?.value;
  return session ? `session:${session}` : `ip:${clientIp(request)}`;
}

function enforceRateLimit(request: NextRequest) {
  const policy = limitFor(request.nextUrl.pathname);
  const now = Date.now();
  const key = `${rateLimitKey(request)}:${request.nextUrl.pathname}`;
  const window = rateWindows.get(key);
  if (!window || now - window.startedAt >= policy.windowMs) {
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
  if (!origin || origin !== request.nextUrl.origin) {
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
