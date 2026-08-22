"use client";

import { ShieldCheck } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { AlertInbox } from "@/components/alerts/AlertInbox";
import { EmptyState, ErrorState, LoadingRows } from "@/components/common/QueryState";
import { useAlerts } from "@/hooks/use-vigileye-data";

export default function AlertsPage() {
  const { data, isLoading, isError, error, refetch } = useAlerts();

  return (
    <>
      <Topbar title="Alert Inbox" />
      <div className="min-h-0 flex-1">
        {isLoading ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No active alerts"
            description="Every monitored structure is currently within normal parameters. Alerts appear here the moment a detection crosses a severity threshold."
          />
        ) : (
          <AlertInbox alerts={data.items} />
        )}
      </div>
    </>
  );
}
