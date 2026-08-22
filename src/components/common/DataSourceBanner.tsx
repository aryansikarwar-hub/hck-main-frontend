"use client";

import { AlertTriangle } from "lucide-react";
import { IS_API_CONFIGURED } from "@/lib/api-client";

/**
 * Makes a misconfigured build impossible to mistake for a working one.
 *
 * This dashboard used to fall back to mock-data.ts whenever
 * NEXT_PUBLIC_API_URL was missing, rendering invented structures, detections
 * and alerts with no indication they were fake. For a structural-safety tool
 * that is the worst possible failure mode: it looks like everything is fine.
 *
 * The fixtures are gone. If the API is not configured the app now says so,
 * loudly and on every dashboard page, and the data views show their own error
 * states rather than inventing anything.
 *
 * NEXT_PUBLIC_API_URL is inlined at build time, so setting it on Vercel
 * requires a redeploy before this banner disappears.
 */
export function DataSourceBanner() {
  if (IS_API_CONFIGURED) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 border-b border-severity-critical/30 bg-severity-critical/10 px-4 py-2 text-sm text-severity-critical md:px-6"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold">No backend configured.</span>{" "}
        <code className="rounded bg-severity-critical/15 px-1 py-0.5 text-xs">NEXT_PUBLIC_API_URL</code> is not set for
        this deployment, so no monitoring data can be loaded. Set it to the API&apos;s base URL and redeploy — see the
        README.
      </p>
    </div>
  );
}