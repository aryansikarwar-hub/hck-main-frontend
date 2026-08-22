import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, backendBaseUrl } from "@/lib/auth-cookies";

/**
 * Authenticated ingestion proxy.
 *
 * The browser CANNOT post straight to the NestJS API: POST /api/ingest/:id is
 * role-guarded (inspector/engineer/admin) and needs a bearer token, but this
 * app deliberately keeps tokens in httpOnly cookies that client-side
 * JavaScript cannot read. A direct cross-origin upload would therefore always
 * come back 401 — and would need CORS opened up for file uploads on top.
 *
 * So the upload goes same-origin to this route, which reads the httpOnly
 * cookie server-side, attaches the Authorization header, and forwards the
 * multipart body to the API untouched (boundary and all).
 */
export const runtime = "nodejs";
// Cold-starting the backend AND the ML service can take a while on free tiers.
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: { structureId: string } }) {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { message: "Your session has expired. Please sign in again." } },
      { status: 401 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: { message: "Expected a multipart/form-data upload." } },
      { status: 400 }
    );
  }

  // Buffer the body rather than streaming it: the boundary in the original
  // Content-Type header stays valid, and every Node/undici version handles
  // this the same way.
  const body = await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(`${backendBaseUrl()}/api/ingest/${params.structureId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
  } catch (error) {
    console.error("[ingest] upstream request failed:", error);
    return NextResponse.json(
      {
        error: {
          message:
            "Could not reach the analysis service. It may still be starting up — please try again in a minute.",
        },
      },
      { status: 502 }
    );
  }

  const text = await upstream.text();

  if (!upstream.ok) {
    let message: string | undefined;
    try {
      message = (JSON.parse(text) as { error?: { message?: string } })?.error?.message;
    } catch {
      /* upstream returned HTML or an empty body — fall through to defaults */
    }

    if (upstream.status === 401 || upstream.status === 403) {
      // Ingestion is restricted to inspector/engineer/admin roles.
      message ??= "Your session has expired, or your account isn't allowed to upload inspection media.";
    } else if (upstream.status === 404) {
      message ??= "That structure no longer exists.";
    } else if (upstream.status === 503) {
      // MlService maps the Python service's "no model loaded" to a 503.
      message ??= "No crack-detection model is loaded on the ML service yet, so this image can't be analysed.";
    } else if (upstream.status === 413) {
      message ??= "That file is too large to upload.";
    } else if (upstream.status >= 500) {
      console.error(`[ingest] upstream ${upstream.status}: ${text.slice(0, 300)}`);
      message ??= "The analysis service failed while processing this image.";
    }

    return NextResponse.json(
      { error: { message: message ?? "Upload failed." } },
      { status: upstream.status }
    );
  }

  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}