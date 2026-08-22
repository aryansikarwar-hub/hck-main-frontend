import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, backendBaseUrl } from "@/lib/auth-cookies";

/**
 * Authenticated GraphQL proxy. The browser calls this same-origin route; the
 * bearer token is attached here, server-side, from the httpOnly cookie. This
 * is what lets the client hold no token at all.
 */
export async function POST(request: Request) {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ errors: [{ message: "Not authenticated" }] }, { status: 401 });
  }

  const body = await request.text();
  const upstream = await fetch(`${backendBaseUrl()}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body,
    cache: "no-store",
  });

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
