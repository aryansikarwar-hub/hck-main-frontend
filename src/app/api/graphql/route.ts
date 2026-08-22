import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, assertNotSelfReferential, backendBaseUrl } from "@/lib/auth-cookies";

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

  let base: string;
  try {
    base = backendBaseUrl();
    assertNotSelfReferential(base, request);
  } catch (error) {
    console.error("[graphql] API base URL misconfigured:", error);
    return NextResponse.json(
      { errors: [{ message: "Server is misconfigured — the API URL is not set correctly." }] },
      { status: 500 }
    );
  }

  const body = await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    console.error("[graphql] upstream request failed:", error);
    return NextResponse.json(
      { errors: [{ message: "Could not reach the API. Please try again." }] },
      { status: 502 }
    );
  }

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}