import type { NextResponse } from "next/server";

/**
 * Tokens live in httpOnly cookies set by Next's server routes, never in
 * localStorage. localStorage is readable by any injected script, so a single
 * XSS anywhere on the page leaks a valid session; httpOnly cookies are not
 * reachable from JavaScript at all.
 */
export const ACCESS_COOKIE = "vigileye_at";
export const REFRESH_COOKIE = "vigileye_rt";

const isProd = process.env.NODE_ENV === "production";

const baseCookie = {
  httpOnly: true,
  secure: isProd,
  // "lax" still sends the cookie on top-level navigations but not on
  // cross-site POSTs, which blocks the classic CSRF shape.
  sameSite: "lax" as const,
  path: "/",
};

export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
  rememberMe = true
) {
  // Access cookie always has a short lifetime matching the token TTL.
  res.cookies.set(ACCESS_COOKIE, accessToken, { ...baseCookie, maxAge: 60 * 15 });
  // Without "remember me" the refresh cookie is session-scoped (no maxAge),
  // so closing the browser ends the session — important on shared machines.
  res.cookies.set(
    REFRESH_COOKIE,
    refreshToken,
    rememberMe ? { ...baseCookie, maxAge: 60 * 60 * 24 * 30 } : { ...baseCookie }
  );
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...baseCookie, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...baseCookie, maxAge: 0 });
}

/**
 * Base URL of the NestJS API.
 *
 * Prefers the server-only API_URL; falls back to the public one so existing
 * deployments keep working. Outside development a missing value is a hard
 * error rather than a silent fall back to localhost — on a serverless host
 * the localhost fetch just fails somewhere confusing instead of here.
 */
export function backendBaseUrl(): string {
  const raw = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;

  if (!raw) {
    if (isProd) {
      throw new Error(
        "API_URL (or NEXT_PUBLIC_API_URL) is not set. Point it at the backend's GraphQL endpoint, e.g. https://your-api.onrender.com/graphql"
      );
    }
    return "http://localhost:8000";
  }

  // Accept either ".../graphql" or a bare origin.
  return raw.trim().replace(/\/+$/, "").replace(/\/graphql$/, "");
}

/**
 * Guards against the API base pointing back at this same deployment.
 *
 * If it does, every /api/auth/* route fetches itself: Vercel unwinds the
 * recursion and answers 508 Loop Detected, which the route then passes
 * through to the browser as a generic "Login failed". Failing here instead
 * names the actual problem.
 */
export function assertNotSelfReferential(base: string, request: Request): void {
  let baseHost: string;
  let selfHost: string;
  try {
    baseHost = new URL(base).host;
    selfHost = new URL(request.url).host;
  } catch {
    return; // Malformed URL: let fetch produce its own error.
  }

  if (baseHost === selfHost) {
    throw new Error(
      `API base URL (${base}) points at this app's own host (${selfHost}). Set API_URL to the backend service URL, not the frontend's.`
    );
  }
}