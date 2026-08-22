import { NextResponse } from "next/server";
import { assertNotSelfReferential, backendBaseUrl, clientIpHeaders, setAuthCookies } from "@/lib/auth-cookies";

interface SignupResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
  error?: { message?: string; details?: unknown };
}

/**
 * Signup mirrors login: the API is called server-side and the resulting
 * tokens go straight into httpOnly cookies.
 *
 * It now mirrors login's error handling too. This route used to call fetch
 * with no try/catch, no timeout, and no check that tokens actually came back —
 * so an unreachable or misconfigured backend surfaced as an unhandled
 * exception and a bare 500, telling the user nothing. Everything below has a
 * counterpart in ../login/route.ts; keep the two in step.
 */
export async function POST(request: Request) {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body" } }, { status: 400 });
  }

  let base: string;
  try {
    base = backendBaseUrl();
    assertNotSelfReferential(base, request);
  } catch (error) {
    console.error("[auth/signup] API base URL misconfigured:", error);
    return NextResponse.json(
      { error: { message: "Server is misconfigured — the API URL is not set correctly." } },
      { status: 500 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Without this the backend rate-limits every user as one client.
        ...clientIpHeaders(request),
      },
      body: JSON.stringify({ email: body.email, password: body.password, name: body.name }),
      cache: "no-store",
      // A sleeping free-tier backend can be slow to wake, but not forever.
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    console.error("[auth/signup] upstream request failed:", error);
    return NextResponse.json(
      { error: { message: "Could not reach the authentication service. Please try again." } },
      { status: 502 }
    );
  }

  const data: SignupResponse = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    if (upstream.status >= 500) {
      console.error(`[auth/signup] upstream ${upstream.status} from ${base}/api/auth/signup`);
      return NextResponse.json(
        { error: { message: "The authentication service is unavailable. Please try again shortly." } },
        { status: 502 }
      );
    }

    // class-validator returns an array of field errors under details; surface
    // the first one so "Password must be at least 10 characters" reaches the
    // form instead of a generic failure.
    const details = data?.error?.details;
    const message = Array.isArray(details) ? details[0] : data?.error?.message;
    return NextResponse.json(
      { error: { message: message ?? "Could not create the account" } },
      { status: upstream.status }
    );
  }

  if (!data.accessToken || !data.refreshToken) {
    console.error("[auth/signup] upstream returned success without tokens");
    return NextResponse.json(
      { error: { message: "Unexpected response from the authentication service." } },
      { status: 502 }
    );
  }

  const res = NextResponse.json({ user: data.user });
  setAuthCookies(res, data.accessToken, data.refreshToken);
  return res;
}
