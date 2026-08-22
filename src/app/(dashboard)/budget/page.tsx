"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingRows } from "@/components/common/QueryState";
import { useAlerts, useStructures } from "@/hooks/use-vigileye-data";
import type { BudgetItem, Severity } from "@/lib/types";
import { SEVERITY_COLOR_CLASS, SEVERITY_LABEL, cn } from "@/lib/utils";

/**
 * Cost/priority model.
 *
 * These are the simulator's ASSUMPTIONS, not data — the inputs (which alerts
 * exist, how severe they are, how critical each structure is) all come from
 * the API. Previously this whole page was computed from a fixtures file, so
 * the numbers looked like a real budget while being entirely invented; now
 * only the model is hardcoded, and it is stated on the page.
 */
const SEVERITY_SCORE: Record<Severity, number> = { low: 15, medium: 45, high: 70, critical: 95 };
const SEVERITY_BASE_COST_USD: Record<Severity, number> = {
  low: 2_500,
  medium: 9_000,
  high: 28_000,
  critical: 65_000,
};

export default function BudgetPage() {
  const alertsQuery = useAlerts(100, 0);
  const structuresQuery = useStructures();

  const isLoading = alertsQuery.isLoading || structuresQuery.isLoading;
  const isError = alertsQuery.isError || structuresQuery.isError;
  const error = (alertsQuery.error ?? structuresQuery.error) as Error | null;

  const items = useMemo<BudgetItem[]>(() => {
    const alerts = alertsQuery.data?.items;
    if (!alerts?.length) return [];

    const criticalityById = new Map(
      (structuresQuery.data ?? []).map((s) => [s.id, s.criticalityWeight ?? 1] as const)
    );

    return alerts
      .filter((a) => !a.acknowledged)
      .map<BudgetItem>((a) => {
        const criticality = criticalityById.get(a.structureId) ?? 1;
        return {
          structureId: a.structureId,
          structureName: a.structureName,
          detectionId: a.detectionId,
          severity: a.severity,
          priorityScore: Math.round(SEVERITY_SCORE[a.severity] * criticality),
          estimatedCostUsd: SEVERITY_BASE_COST_USD[a.severity] * criticality,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [alertsQuery.data, structuresQuery.data]);

  const totalCost = items.reduce((sum, i) => sum + i.estimatedCostUsd, 0);
  const maxScore = Math.max(...items.map((i) => i.priorityScore), 1);

  return (
    <>
      <Topbar title="Budget Simulator" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingRows rows={5} />
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={() => { alertsQuery.refetch(); structuresQuery.refetch(); }} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title="Nothing to fund right now"
            description="The budget ranking is built from unacknowledged alerts. When a detection crosses a severity threshold it appears here with an estimated repair cost."
          />
        ) : (
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="eyebrow mb-1">Active repair items</p>
                  <p className="text-2xl font-semibold">{items.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="eyebrow mb-1">Estimated near-term budget</p>
                  <p className="text-2xl font-semibold text-primary">${totalCost.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="eyebrow mb-1">Top priority</p>
                  <p className="truncate text-2xl font-semibold">{items[0]?.structureName ?? "—"}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Repair priority ranking</CardTitle>
                <CardDescription>
                  Ranked from live unacknowledged alerts. priority = severity × structure criticality; cost is a
                  planning estimate from the same two factors, not a quotation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((item, i) => (
                  <motion.div
                    key={item.detectionId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.05 }}
                  >
                    <Link
                      href={`/structures/${item.structureId}`}
                      className="flex items-center gap-4 rounded-lg border border-border/40 p-4 transition-colors hover:bg-muted"
                    >
                      <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground">#{i + 1}</span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-pill border px-2 py-0.5 text-xs font-medium", SEVERITY_COLOR_CLASS[item.severity])}>
                            {SEVERITY_LABEL[item.severity]}
                          </span>
                          <span className="text-sm font-medium">{item.structureName}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-pill bg-muted">
                          <motion.div
                            className="h-full rounded-pill bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.priorityScore / maxScore) * 100}%` }}
                            transition={{ duration: 0.6, delay: Math.min(i, 10) * 0.05 + 0.1 }}
                          />
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">${item.estimatedCostUsd.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">score {item.priorityScore}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}