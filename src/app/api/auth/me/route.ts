import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, backendBaseUrl } from "@/lib/auth-cookies";

/** Returns the current user, or 401. Used to restore a session on page load. */
export async function GET() {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });

  const upstream = await fetch(`${backendBaseUrl()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: { message: "Session expired" } }, { status: 401 });
  }
  return NextResponse.json(await upstream.json());
}
