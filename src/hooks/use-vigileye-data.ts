"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATIONS, QUERIES, gql } from "@/lib/api-client";
import type { Alert, Detection, Structure } from "@/lib/types";

export const queryKeys = {
  structures: (filters?: StructureFilters) => ["structures", filters ?? {}] as const,
  structure: (id: string) => ["structure", id] as const,
  alerts: (limit: number, offset: number) => ["alerts", limit, offset] as const,
};

export interface StructureFilters {
  [key: string]: string | undefined;
  riskLevel?: string;
  type?: string;
  zoneId?: string;
}

export function useStructures(filters: StructureFilters = {}) {
  return useQuery({
    queryKey: queryKeys.structures(filters),
    queryFn: () => gql<{ structures: Structure[] }>(QUERIES.structures, filters).then((d) => d.structures),
  });
}

export function useStructure(id: string) {
  return useQuery({
    queryKey: queryKeys.structure(id),
    queryFn: () =>
      gql<{ structure: Structure & { detections: Detection[] } }>(QUERIES.structureDetail, { id }).then(
        (d) => d.structure
      ),
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
    queryFn: () => gql<{ alerts: PagedAlerts }>(QUERIES.alerts, { limit, offset }).then((d) => d.alerts),
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
