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

/** Base URL of the NestJS API, derived from the public GraphQL endpoint. */
export function backendBaseUrl(): string {
  const gql = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/graphql";
  return gql.replace(/\/graphql\/?$/, "");
}
