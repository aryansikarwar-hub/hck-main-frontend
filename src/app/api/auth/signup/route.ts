import { NextResponse } from "next/server";
import { backendBaseUrl, setAuthCookies } from "@/lib/auth-cookies";

/** Signup mirrors login: the API is called server-side and the resulting
 *  tokens go straight into httpOnly cookies. */
export async function POST(request: Request) {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body" } }, { status: 400 });
  }

  const upstream = await fetch(`${backendBaseUrl()}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password, name: body.name }),
    cache: "no-store",
  });

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    // class-validator returns an array of field errors under details.
    const details = data?.error?.details;
    const message = Array.isArray(details) ? details[0] : data?.error?.message;
    return NextResponse.json(
      { error: { message: message ?? "Could not create the account" } },
      { status: upstream.status }
    );
  }

  const res = NextResponse.json({ user: data.user });
  setAuthCookies(res, data.accessToken, data.refreshToken);
  return res;
}
