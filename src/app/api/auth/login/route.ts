import { NextResponse } from "next/server";
import { assertNotSelfReferential, backendBaseUrl, setAuthCookies } from "@/lib/auth-cookies";

interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
  error?: { message?: string };
}

/**
 * Backend-for-frontend login. The browser posts credentials here; this route
 * calls the API server-side and puts the resulting tokens into httpOnly
 * cookies. Tokens are therefore never exposed to client-side JavaScript.
 */
export async function POST(request: Request) {
  let body: { email?: string; password?: string; rememberMe?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body" } }, { status: 400 });
  }

  let base: string;
  try {
    base = backendBaseUrl();
    // A base that points back at this deployment would make the route call
    // itself until the platform kills the recursion with a 508.
    assertNotSelfReferential(base, request);
  } catch (error) {
    console.error("[auth/login] API base URL misconfigured:", error);
    return NextResponse.json(
      { error: { message: "Server is misconfigured — the API URL is not set correctly." } },
      { status: 500 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: "no-store",
      // A sleeping free-tier backend can be slow to wake, but not forever.
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    console.error("[auth/login] upstream request failed:", error);
    return NextResponse.json(
      { error: { message: "Could not reach the authentication service. Please try again." } },
      { status: 502 }
    );
  }

  const data: LoginResponse = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    // 4xx comes from the API and is meant for the user (bad credentials,
    // locked account) — pass its message through. 5xx is our problem, not
    // theirs: don't echo an opaque platform status like 508 to the browser.
    if (upstream.status >= 500) {
      console.error(`[auth/login] upstream ${upstream.status} from ${base}/api/auth/login`);
      return NextResponse.json(
        { error: { message: "The authentication service is unavailable. Please try again shortly." } },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: { message: data?.error?.message ?? "Login failed" } },
      { status: upstream.status }
    );
  }

  if (!data.accessToken || !data.refreshToken) {
    console.error("[auth/login] upstream returned 200 without tokens");
    return NextResponse.json(
      { error: { message: "Unexpected response from the authentication service." } },
      { status: 502 }
    );
  }

  const res = NextResponse.json({ user: data.user });
  setAuthCookies(res, data.accessToken, data.refreshToken, body.rememberMe !== false);
  return res;
}