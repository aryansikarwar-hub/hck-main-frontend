"use client";

import { AnimatePresence } from "framer-motion";
import type { Alert } from "@/lib/types";
import { AlertCard } from "./AlertCard";
import { Skeleton } from "@/components/ui/skeleton";

const SEVERITY_ORDER: Record<Alert["severity"], number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function AlertInboxSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border/40 bg-card p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

/**
 * Renders a non-empty list. The empty case belongs to the alerts page, which
 * is the only caller that also knows whether anything is being monitored —
 * this component used to answer it with "all monitored structures are within
 * normal parameters", which is a safety claim it cannot make.
 */
export function AlertInbox({ alerts }: { alerts: Alert[] }) {
  const sorted = [...alerts].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return (
    <div className="flex flex-col gap-2 overflow-y-auto p-4">
      <AnimatePresence initial={false}>
        {sorted.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </AnimatePresence>
    </div>
  );
}
