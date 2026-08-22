"use client";

import { useMemo, useState } from "react";
import { MapPinOff } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { StructureMap, type MapView } from "@/components/map/StructureMap";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingRows } from "@/components/common/QueryState";
import { RegisterStructureDialog } from "@/components/structure/RegisterStructureDialog";
import { useStructures } from "@/hooks/use-vigileye-data";
import type { Structure, ZoneRisk } from "@/lib/types";

const SEVERITY_SCORE: Record<string, number> = { low: 15, medium: 45, high: 70, critical: 95 };

/**
 * Zone risk is derived from live structures rather than seeded: each zone's
 * score is the mean severity of the structures in it, weighted by how costly
 * each one's failure would be.
 */
function deriveZoneRisks(structures: ReturnType<typeof useStructures>["data"]): ZoneRisk[] {
  if (!structures?.length) return [];

  const byZone = new Map<string, typeof structures>();
  for (const s of structures) {
    const list = byZone.get(s.zoneId);
    if (list) list.push(s);
    else byZone.set(s.zoneId, [s]);
  }

  return Array.from(byZone.entries()).map(([zoneId, members]) => {
    const totalWeight = members.reduce((sum, m) => sum + (m.criticalityWeight ?? 1), 0);
    const weighted = members.reduce(
      (sum, m) => sum + (SEVERITY_SCORE[m.riskLevel] ?? 0) * (m.criticalityWeight ?? 1),
      0
    );
    return {
      zoneId,
      zoneName: zoneId.replace(/^zone-/, "").replace(/\b\w/g, (c) => c.toUpperCase()),
      lat: members.reduce((sum, m) => sum + m.lat, 0) / members.length,
      lng: members.reduce((sum, m) => sum + m.lng, 0) / members.length,
      aggregateRiskScore: Math.round(weighted / Math.max(totalWeight, 1)),
      structureCount: members.length,
    };
  });
}

export default function MapPage() {
  const [view, setView] = useState<MapView>("pins");
  const { data: structures, isLoading, isError, error, refetch } = useStructures();

  const zones = useMemo(() => deriveZoneRisks(structures), [structures]);

  // Where to fly the camera after a structure is registered. Cleared back to
  // null on the next registration isn't necessary — a fresh coordinate object
  // each time is enough to make StructureMap's effect re-run and re-fly.
  const [focusLocation, setFocusLocation] = useState<{ lat: number; lng: number } | null>(null);
  const focusOnNewStructure = (structure: Structure) => {
    setView("pins"); // the new pin isn't visible from the heatmap tab
    setFocusLocation({ lat: structure.lat, lng: structure.lng });
  };

  return (
    <>
      <Topbar title="Live Structure Map" />
      <div className="flex items-center justify-end gap-3 border-b border-border/30 px-4 py-2 md:px-6">
        <Tabs value={view} onValueChange={(v) => setView(v as MapView)}>
          <TabsList>
            <TabsTrigger value="pins">Structures</TabsTrigger>
            <TabsTrigger value="heatmap">Risk heatmap</TabsTrigger>
          </TabsList>
        </Tabs>
        <RegisterStructureDialog onRegistered={focusOnNewStructure} />
      </div>
      <div className="min-h-0 flex-1">
        {isLoading ? (
          <LoadingRows rows={4} />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : !structures || structures.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <EmptyState
              icon={MapPinOff}
              title="No structures registered yet"
              description="Add a bridge, dam, building or tunnel to begin monitoring it. Structures appear on the map as soon as they're registered."
            />
            {/* Without this the empty state is a dead end: the only other
                trigger sits in the toolbar above, which reads as a filter
                control rather than the way forward. */}
            <RegisterStructureDialog onRegistered={focusOnNewStructure} />
          </div>
        ) : (
          <StructureMap structures={structures} zones={zones} view={view} focusLocation={focusLocation} />
        )}
      </div>
    </>
  );
}