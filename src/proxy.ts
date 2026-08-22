import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

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
  if (isApiPath(request.nextUrl.pathname)) return guardApi(request);
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
