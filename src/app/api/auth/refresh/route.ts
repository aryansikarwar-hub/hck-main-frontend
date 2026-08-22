import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { REFRESH_COOKIE, backendBaseUrl, clearAuthCookies, setAuthCookies } from "@/lib/auth-cookies";

/** Exchanges the httpOnly refresh cookie for a new token pair. */
export async function POST() {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: { message: "No refresh token" } }, { status: 401 });
  }

  const upstream = await fetch(`${backendBaseUrl()}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });

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
