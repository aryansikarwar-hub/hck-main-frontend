"use client";

import { useMemo, useState } from "react";
import { ScanSearch } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SeverityTrendChart } from "@/components/structure/SeverityTrendChart";
import { DetectionTimeline } from "@/components/structure/DetectionTimeline";
import { BeforeAfterSlider } from "@/components/structure/BeforeAfterSlider";
import { ExplanationPanel } from "@/components/structure/ExplanationPanel";
import { EmptyState, ErrorState, LoadingRows } from "@/components/common/QueryState";
import { useStructure } from "@/hooks/use-vigileye-data";
import type { Detection } from "@/lib/types";
import { SEVERITY_COLOR_CLASS, SEVERITY_LABEL, cn, formatDate } from "@/lib/utils";

/** Width at which a crack is treated as structurally critical. Engineering
 *  constant, not data — kept here so the chart and the projection agree. */
const CRITICAL_WIDTH_MM = 5;

/** A projection, computed from this structure's own recorded measurements. */
interface WidthProjection {
  projectedCriticalDate: string;
  growthRateMmPerMonth: number;
  measurements: number;
}

/**
 * Least-squares fit over the real measurement history, extrapolated to the
 * critical threshold.
 *
 * This replaces the hardcoded `mockForecasts` table. It is honest about its
 * own limits: it returns null with fewer than two measurements, and null when
 * the crack is not actually growing — rather than inventing a date.
 */
function projectTimeToCritical(history: { date: string; widthMm: number }[]): WidthProjection | null {
  if (history.length < 2) return null;

  const points = history
    .map((h) => ({ t: new Date(h.date).getTime(), w: h.widthMm }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (points.length < 2) return null;

  const t0 = points[0].t;
  const MONTH_MS = 1000 * 60 * 60 * 24 * 30;
  const xs = points.map((p) => (p.t - t0) / MONTH_MS);
  const ys = points.map((p) => p.w);

  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  if (denominator === 0) return null;

  const slope = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0) / denominator;
  if (slope <= 0) return null; // stable or closing — no critical date to project

  const latest = points[points.length - 1];
  const monthsToCritical = (CRITICAL_WIDTH_MM - latest.w) / slope;
  if (!Number.isFinite(monthsToCritical) || monthsToCritical < 0) return null;

  return {
    projectedCriticalDate: new Date(latest.t + monthsToCritical * MONTH_MS).toISOString(),
    growthRateMmPerMonth: Math.round(slope * 100) / 100,
    measurements: points.length,
  };
}

export default function StructureDetailPage({ params }: { params: { id: string } }) {
  const { data: structure, isLoading, isError, error, refetch } = useStructure(params.id);
  const [selected, setSelected] = useState<Detection | null>(null);

  const detections = useMemo(
    () =>
      [...(structure?.detections ?? [])].sort(
        (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
      ),
    [structure]
  );

  // Trend + projection come from the structure's own recorded detections.
  const history = useMemo(
    () =>
      [...detections]
        .reverse()
        .map((d) => ({ date: d.capturedAt, widthMm: d.widthMm })),
    [detections]
  );

  const projection = useMemo(() => projectTimeToCritical(history), [history]);

  if (isLoading) {
    return (
      <>
        <Topbar title="Structure" />
        <div className="min-h-0 flex-1">
          <LoadingRows rows={4} />
        </div>
      </>
    );
  }

  if (isError || !structure) {
    return (
      <>
        <Topbar title="Structure" />
        <div className="min-h-0 flex-1">
          <ErrorState
            message={(error as Error)?.message ?? "This structure could not be loaded."}
            onRetry={() => refetch()}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={structure.name} />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className={cn("rounded-pill border px-3 py-1 text-xs font-medium", SEVERITY_COLOR_CLASS[structure.riskLevel])}>
            {SEVERITY_LABEL[structure.riskLevel]} risk
          </span>
          <span className="text-sm text-muted-foreground capitalize">{structure.type}</span>
          <span className="text-sm text-muted-foreground">· last inspected {formatDate(structure.lastInspected)}</span>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detections">Detections ({detections.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Severity trend</CardTitle>
                  <CardDescription>
                    Measured crack width across {history.length} recorded inspection
                    {history.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {history.length >= 2 ? (
                    <SeverityTrendChart history={history} criticalThresholdMm={CRITICAL_WIDTH_MM} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      At least two inspections of this structure are needed before a trend can be plotted.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Time-to-critical forecast</CardTitle>
                  <CardDescription>Linear projection from recorded measurements</CardDescription>
                </CardHeader>
                <CardContent>
                  {projection ? (
                    <div className="space-y-2">
                      <p className="text-2xl font-semibold text-primary">
                        {formatDate(projection.projectedCriticalDate)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Projected to cross the {CRITICAL_WIDTH_MM}mm critical threshold at the observed growth rate of{" "}
                        {projection.growthRateMmPerMonth}mm/month.
                      </p>
                      <span className="eyebrow">
                        fitted on {projection.measurements} measurement{projection.measurements === 1 ? "" : "s"}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {history.length < 2
                        ? "Not enough repeated measurements to forecast yet."
                        : "No measurable growth across the recorded inspections — nothing to project."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="detections">
            {detections.length === 0 ? (
              <EmptyState
                icon={ScanSearch}
                title="No detections recorded"
                description="Upload an inspection image for this structure and any cracks the model finds will appear here."
              />
            ) : (
              <DetectionTimeline detections={detections} onSelect={setSelected} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="capitalize">{selected.crackType} crack — {selected.location}</DialogTitle>
                <DialogDescription>
                  {selected.widthMm}mm × {selected.lengthCm}cm · {Math.round(selected.confidence * 100)}% confidence ·
                  captured {formatDate(selected.capturedAt)} via {selected.capturedBy}
                </DialogDescription>
              </DialogHeader>
              {selected.previousImageUrl ? (
                <BeforeAfterSlider />
              ) : (
                <div className="aspect-video w-full rounded-md bg-muted" aria-hidden />
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={cn("inline-block rounded-pill border px-2.5 py-0.5 text-xs font-medium", SEVERITY_COLOR_CLASS[selected.severity])}>
                  {SEVERITY_LABEL[selected.severity]} severity
                </span>
                {selected.measurementSource && (
                  <span className="inline-block rounded-pill border border-border/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                    width via {selected.measurementSource === "segmentation" ? "segmentation mask" : "bbox heuristic"}
                  </span>
                )}
              </div>

              {selected.explanation && (
                <div className="mt-4">
                  <ExplanationPanel explanation={selected.explanation} />
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}