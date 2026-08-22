"use client";

import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { AlertInbox } from "@/components/alerts/AlertInbox";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows } from "@/components/common/QueryState";
import { RegisterStructureDialog } from "@/components/structure/RegisterStructureDialog";
import { useAlerts, useStructures } from "@/hooks/use-vigileye-data";

export default function AlertsPage() {
  const { data, isLoading, isError, error, refetch } = useAlerts();
  // Only to tell two very different empty inboxes apart — see below.
  const structures = useStructures();

  const nothingMonitored = structures.isSuccess && structures.data.length === 0;

  return (
    <>
      <Topbar title="Alert Inbox" />
      <div className="min-h-0 flex-1">
        {isLoading ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : !data || data.items.length === 0 ? (
          /*
           * An empty inbox means two opposite things, and saying the wrong one
           * is dangerous. This page used to claim "Every monitored structure is
           * currently within normal parameters" unconditionally — on a fresh
           * deployment with zero structures, that is an all-clear for a system
           * that has never looked at anything.
           */
          nothingMonitored ? (
            <EmptyState
              icon={Building2}
              title="Nothing is being monitored yet"
              description="This is not an all-clear: no structures are registered, so nothing has been analysed and no alert could have been raised. Register a structure to begin."
              action={<RegisterStructureDialog />}
            />
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title="No active alerts"
              description="No detection on a monitored structure has crossed a severity threshold. Alerts appear here the moment one does — this page refreshes every 30 seconds."
              action={
                <Link href="/upload">
                  <Button variant="outline">Upload an inspection image</Button>
                </Link>
              }
            />
          )
        ) : (
          <AlertInbox alerts={data.items} />
        )}
      </div>
    </>
  );
}
