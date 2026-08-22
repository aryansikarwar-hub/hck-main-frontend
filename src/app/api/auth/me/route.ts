import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, assertNotSelfReferential, backendBaseUrl } from "@/lib/auth-cookies";

/** Returns the current user, or 401. Used to restore a session on page load. */
export async function GET(request: Request) {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });

  let base: string;
  try {
    base = backendBaseUrl();
    assertNotSelfReferential(base, request);
  } catch (error) {
    console.error("[auth/me] API base URL misconfigured:", error);
    return NextResponse.json(
      { error: { message: "Server is misconfigured — the API URL is not set correctly." } },
      { status: 500 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    console.error("[auth/me] upstream request failed:", error);
    return NextResponse.json(
      { error: { message: "Could not reach the authentication service." } },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: { message: "Session expired" } }, { status: 401 });
  }
  return NextResponse.json(await upstream.json());
}