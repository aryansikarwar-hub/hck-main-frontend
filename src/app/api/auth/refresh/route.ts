import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  REFRESH_COOKIE,
  assertNotSelfReferential,
  backendBaseUrl,
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/auth-cookies";

/** Exchanges the httpOnly refresh cookie for a new token pair. */
export async function POST(request: Request) {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: { message: "No refresh token" } }, { status: 401 });
  }

  let base: string;
  try {
    base = backendBaseUrl();
    assertNotSelfReferential(base, request);
  } catch (error) {
    console.error("[auth/refresh] API base URL misconfigured:", error);
    return NextResponse.json(
      { error: { message: "Server is misconfigured — the API URL is not set correctly." } },
      { status: 500 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    console.error("[auth/refresh] upstream request failed:", error);
    // Don't clear cookies on a transport failure — the session may be fine.
    return NextResponse.json(
      { error: { message: "Could not reach the authentication service." } },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    // Refresh failed — clear the stale cookies so the client stops retrying
    // and is sent back to login.
    const res = NextResponse.json({ error: { message: "Session expired" } }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }

  const data = await upstream.json();
  const res = NextResponse.json({ user: data.user });
  setAuthCookies(res, data.accessToken, data.refreshToken);
  return res;
}