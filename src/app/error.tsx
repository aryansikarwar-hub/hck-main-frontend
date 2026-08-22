"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary. `digest` is the server-side error id — showing
 * it lets a user quote something specific in a bug report without exposing
 * the underlying stack trace.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with Sentry.captureException(error) once error monitoring is on.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-severity-critical/10">
        <AlertTriangle className="h-6 w-6 text-severity-critical" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. Monitoring data was not affected.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Reference: <code className="rounded bg-muted px-1.5 py-0.5">{error.digest}</code>
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <a href="/map">
          <Button variant="outline">Back to map</Button>
        </a>
      </div>
    </main>
  );
}
