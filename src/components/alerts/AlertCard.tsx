"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAcknowledgeAlert } from "@/hooks/use-vigileye-data";
import type { Alert } from "@/lib/types";
import { SEVERITY_COLOR_CLASS, SEVERITY_LABEL, cn, relativeTime } from "@/lib/utils";

export function AlertCard({ alert }: { alert: Alert }) {
  const acknowledge = useAcknowledgeAlert();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
    >
      <Link href={`/structures/${alert.structureId}`}>
        <Card className={cn("transition-colors hover:bg-muted", !alert.acknowledged && "border-l-4 border-l-primary")}>
          <CardContent className="flex items-start justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("rounded-pill border px-2 py-0.5 text-xs font-medium", SEVERITY_COLOR_CLASS[alert.severity])}>
                  {SEVERITY_LABEL[alert.severity]}
                </span>
                <span className="text-sm font-medium">{alert.structureName}</span>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{alert.message}</p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {/*
               * useAcknowledgeAlert and the acknowledgeAlert mutation both
               * existed but nothing called them, so an alert could never be
               * cleared from the app: the inbox grew forever and the budget
               * simulator — which ranks exactly the UNacknowledged alerts —
               * had no way to ever shrink. The card is a Link, hence the
               * preventDefault: acknowledging must not navigate away.
               */}
              {alert.acknowledged ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Acknowledged
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={acknowledge.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    acknowledge.mutate(alert.id);
                  }}
                >
                  {acknowledge.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Acknowledge
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{relativeTime(alert.createdAt)}</span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
