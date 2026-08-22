"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATIONS, QUERIES, gql } from "@/lib/api-client";
import type { AccountUser, Alert, Detection, MlStatus, Role, Structure } from "@/lib/types";
import { normalizeSeverity } from "@/lib/utils";

export const queryKeys = {
  structures: (filters?: StructureFilters) => ["structures", filters ?? {}] as const,
  structure: (id: string) => ["structure", id] as const,
  alerts: (limit: number, offset: number) => ["alerts", limit, offset] as const,
  mlStatus: () => ["ml-status"] as const,
  users: () => ["users"] as const,
};

export interface StructureFilters {
  [key: string]: string | undefined;
  riskLevel?: string;
  type?: string;
  zoneId?: string;
}

/**
 * The API's enums arrive UPPERCASE; this app's types are lowercase.
 *
 * NestJS `registerEnumType` serialises a TypeScript enum by its KEY, not its
 * value — so `Severity.MEDIUM = "medium"` goes over the wire as "MEDIUM" even
 * though Postgres stores "medium". Every lookup keyed by severity
 * (SEVERITY_COLOR_CLASS, SEVERITY_LABEL, SEVERITY_HEX) then missed, and
 * StructureMap crashed the whole /map route with
 * "Cannot read properties of undefined (reading 'split')".
 *
 * Normalising here, at the single boundary where API data enters the app,
 * means every component downstream sees exactly what the TypeScript types
 * promise. Do not scatter `.toLowerCase()` through the components.
 */
function lower<T extends string>(value: unknown, fallback: T): T {
  return typeof value === "string" && value.length > 0 ? (value.toLowerCase() as T) : fallback;
}

function normalizeStructure(s: Structure): Structure {
  return {
    ...s,
    type: lower(s.type, "bridge"),
    riskLevel: normalizeSeverity(s.riskLevel),
  };
}

function normalizeDetection(d: Detection): Detection {
  return {
    ...d,
    severity: normalizeSeverity(d.severity),
    crackType: lower(d.crackType, "hairline"),
    capturedBy: lower(d.capturedBy, "web"),
    measurementSource: d.measurementSource
      ? lower(d.measurementSource, "bbox-heuristic")
      : undefined,
  };
}

function normalizeAlert(a: Alert): Alert {
  return { ...a, severity: normalizeSeverity(a.severity) };
}

export function useStructures(filters: StructureFilters = {}) {
  return useQuery({
    queryKey: queryKeys.structures(filters),
    queryFn: () =>
      gql<{ structures: Structure[] }>(QUERIES.structures, filters).then((d) =>
        (d.structures ?? []).map(normalizeStructure)
      ),
  });
}

export function useStructure(id: string) {
  return useQuery({
    queryKey: queryKeys.structure(id),
    queryFn: () =>
      gql<{ structure: Structure & { detections: Detection[] } }>(QUERIES.structureDetail, { id }).then((d) => ({
        ...normalizeStructure(d.structure),
        detections: (d.structure.detections ?? []).map(normalizeDetection),
      })),
    enabled: Boolean(id),
  });
}

export interface PagedAlerts {
  items: Alert[];
  totalCount: number;
  hasMore: boolean;
}

export function useAlerts(limit = 25, offset = 0) {
  return useQuery({
    queryKey: queryKeys.alerts(limit, offset),
    queryFn: () =>
      gql<{ alerts: PagedAlerts }>(QUERIES.alerts, { limit, offset }).then((d) => ({
        ...d.alerts,
        items: (d.alerts?.items ?? []).map(normalizeAlert),
      })),
    // The inbox is time-sensitive: poll so a new critical alert appears
    // without the user refreshing. Replace with a WebSocket subscription
    // when the realtime gateway lands.
    refetchInterval: 30_000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => gql(MUTATIONS.acknowledgeAlert, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert acknowledged");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not acknowledge the alert");
    },
  });
}

/**
 * Everything an ingest changes.
 *
 * A successful upload writes detection rows, bumps the structure's risk level
 * and detection count, and can raise an alert — but nothing invalidated the
 * caches holding the old values. With `staleTime: 30_000` (see Providers),
 * opening the structure page right after an upload showed the pre-upload data
 * and looked like the analysis had been thrown away.
 */
export function useInvalidateAfterIngest() {
  const queryClient = useQueryClient();

  return (structureId: string) => {
    queryClient.invalidateQueries({ queryKey: ["structures"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.structure(structureId) });
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
  };
}

export interface CreateStructureInput {
  name: string;
  type: Structure["type"];
  lat: number;
  lng: number;
  riskLevel?: string;
  lastInspected?: string;
  criticalityWeight?: number;
  zoneId?: string;
}

export function useCreateStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStructureInput) =>
      gql<{ createStructure: Structure }>(MUTATIONS.createStructure, { input }).then((d) =>
        normalizeStructure(d.createStructure)
      ),
    onSuccess: (structure) => {
      queryClient.invalidateQueries({ queryKey: ["structures"] });
      toast.success(`${structure.name} is now being monitored`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not register the structure");
    },
  });
}

export function useDeleteStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => gql<{ deleteStructure: string }>(MUTATIONS.deleteStructure, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["structures"] });
      toast.success("Structure removed. Its detections and alerts were kept.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not remove the structure");
    },
  });
}

/**
 * Live inference-service status for the admin page.
 *
 * Polled, because the free-tier ML service sleeps: an admin looking at
 * "unreachable" should see it flip to "ready" once it wakes, without
 * reloading.
 */
export function useMlStatus() {
  return useQuery({
    queryKey: queryKeys.mlStatus(),
    queryFn: () => gql<{ mlStatus: MlStatus }>(QUERIES.mlStatus).then((d) => d.mlStatus),
    refetchInterval: 60_000,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users(),
    queryFn: () => gql<{ users: AccountUser[] }>(QUERIES.users).then((d) => d.users ?? []),
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      gql<{ setUserRole: AccountUser }>(MUTATIONS.setUserRole, { id, role }).then((d) => d.setUserRole),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
      toast.success(`${user.email} is now ${user.role}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not change the role");
    },
  });
}