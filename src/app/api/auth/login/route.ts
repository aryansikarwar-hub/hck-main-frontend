import { NextResponse } from "next/server";
import { backendBaseUrl, setAuthCookies } from "@/lib/auth-cookies";

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

  const upstream = await fetch(`${backendBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: "no-store",
  });

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    // Pass the API's message through (it is deliberately generic for bad
    // credentials) without leaking status details beyond what it chose.
    return NextResponse.json(
      { error: { message: data?.error?.message ?? "Login failed" } },
      { status: upstream.status }
    );
  }

  const res = NextResponse.json({ user: data.user });
  setAuthCookies(res, data.accessToken, data.refreshToken, body.rememberMe !== false);
  return res;
}
