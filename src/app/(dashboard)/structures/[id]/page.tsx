"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ScanSearch } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SeverityTrendChart } from "@/components/structure/SeverityTrendChart";
import { DetectionImage, DetectionTimeline } from "@/components/structure/DetectionTimeline";
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

/**
 * The single crack location whose width history is worth plotting.
 *
 * A structure's detections are separate cracks in separate places — "Pier 3,
 * west face" and "Deck soffit, span 2" are not two readings of one thing.
 * Plotting them as one series produced a "growth rate" out of the difference
 * between unrelated cracks and printed a critical DATE from it, which is a
 * fabricated measurement wearing a chart. Group by location first and follow
 * whichever one has actually been measured most often; ties go to the widest,
 * since that is the one an engineer needs to watch.
 */
function trackLocation(
  detections: Detection[]
): { location: string; history: { date: string; widthMm: number }[] } | null {
  if (detections.length === 0) return null;

  const byLocation = new Map<string, Detection[]>();
  for (const d of detections) {
    const key = d.location || "Unspecified location";
    const list = byLocation.get(key);
    if (list) list.push(d);
    else byLocation.set(key, [d]);
  }

  let best: { location: string; members: Detection[] } | null = null;
  for (const [location, members] of byLocation) {
    if (
      !best ||
      members.length > best.members.length ||
      (members.length === best.members.length && widest(members) > widest(best.members))
    ) {
      best = { location, members };
    }
  }
  if (!best) return null;

  return {
    location: best.location,
    // Oldest first: the chart's x-axis and the least-squares fit both read
    // forward in time.
    history: [...best.members]
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
      .map((d) => ({ date: d.capturedAt, widthMm: d.widthMm })),
  };
}

function widest(detections: Detection[]): number {
  return detections.reduce((max, d) => (d.widthMm > max ? d.widthMm : max), 0);
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

  const tracked = useMemo(() => trackLocation(detections), [detections]);
  const projection = useMemo(
    () => (tracked ? projectTimeToCritical(tracked.history) : null),
    [tracked]
  );

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
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn("rounded-pill border px-3 py-1 text-xs font-medium", SEVERITY_COLOR_CLASS[structure.riskLevel])}>
              {SEVERITY_LABEL[structure.riskLevel]} risk
            </span>
            <span className="text-sm text-muted-foreground capitalize">{structure.type}</span>
            <span className="text-sm text-muted-foreground">· last inspected {formatDate(structure.lastInspected)}</span>
          </div>

          {/* The API's riskLevel column is non-nullable, so a structure nobody
              has inspected still reads "Low risk" — a green badge that looks
              like a finding. Say where it came from instead of letting it be
              mistaken for an assessment. */}
          {detections.length === 0 && (
            <p className="rounded-md border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
              No inspection has been analysed for this structure yet, so the risk level above is its registration
              default rather than a measurement.
            </p>
          )}
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
                    {tracked
                      ? `Crack width at ${tracked.location} — ${tracked.history.length} measurement${
                          tracked.history.length === 1 ? "" : "s"
                        }`
                      : "Crack width over successive inspections"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tracked && tracked.history.length >= 2 ? (
                    <SeverityTrendChart history={tracked.history} criticalThresholdMm={CRITICAL_WIDTH_MM} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      A trend needs the same crack measured at least twice.{" "}
                      {tracked
                        ? "So far every recorded location has a single measurement."
                        : "Nothing has been recorded for this structure yet."}
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
                  {projection && tracked ? (
                    <div className="space-y-2">
                      <p className="text-2xl font-semibold text-primary">
                        {formatDate(projection.projectedCriticalDate)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        The crack at {tracked.location} is projected to cross the {CRITICAL_WIDTH_MM}mm critical
                        threshold at its observed growth rate of {projection.growthRateMmPerMonth}mm/month.
                      </p>
                      <span className="eyebrow">
                        straight-line fit over {projection.measurements} measurement
                        {projection.measurements === 1 ? "" : "s"} · other locations on this structure are not
                        included
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {!tracked
                        ? "Nothing recorded yet, so there is nothing to project."
                        : tracked.history.length < 2
                          ? "No crack here has been measured more than once, so there is no growth rate to extrapolate."
                          : "No measurable growth across the recorded measurements — nothing to project."}
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
                description="Nothing has been analysed for this structure yet — this is an absence of data, not an all-clear. Upload an inspection image and any cracks the model finds will appear here."
                action={
                  <Link href="/upload">
                    <Button>Upload an inspection image</Button>
                  </Link>
                }
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
              {/* The annotated frame is the evidence for the flag, and it was
                  being replaced by an empty grey box: the dialog rendered a
                  placeholder unless `previousImageUrl` was set, a field the
                  API has never returned. Show what was actually captured. */}
              <DetectionImage detection={selected} className="aspect-video w-full" />

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={cn("inline-block rounded-pill border px-2.5 py-0.5 text-xs font-medium", SEVERITY_COLOR_CLASS[selected.severity])}>
                  {SEVERITY_LABEL[selected.severity]} severity
                </span>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Width and length are the model&apos;s estimates from this frame. The API does not expose a
                per-factor confidence breakdown or a previous-inspection photo to compare against, so neither is
                shown.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}