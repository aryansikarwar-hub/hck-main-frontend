export type Severity = "low" | "medium" | "high" | "critical";

export interface Structure {
  id: string;
  name: string;
  type: "bridge" | "dam" | "building" | "tunnel";
  lat: number;
  lng: number;
  riskLevel: Severity;
  lastInspected: string; // ISO date
  activeDetections: number;
  /** 1 (low) - 3 (high) — how critical this structure is if it fails (traffic volume, population served, etc). Used by the budget simulator's priority score. */
  criticalityWeight: 1 | 2 | 3;
  /** Zone/district id, for the risk heatmap aggregation. */
  zoneId: string;
}

/**
 * One crack instance, exactly as the API's Detection type defines it.
 *
 * Deliberately no more than that. This interface used to also carry
 * `previousImageUrl`, `measurementSource`, and an `explanation` object with
 * per-factor model confidence — none of which exist on the backend entity or
 * in the GraphQL schema. They came from the deleted mock-data fixtures, and
 * the components that read them (a before/after slider, a confidence
 * breakdown panel) therefore rendered invented visuals for a detection that
 * had no such data. Adding a field back here is only correct once the API
 * actually returns it.
 */
export interface Detection {
  id: string;
  structureId: string;
  imageUrl: string;
  annotatedImageUrl: string;
  crackType: "diagonal" | "vertical" | "horizontal" | "map" | "hairline";
  widthMm: number;
  lengthCm: number;
  severity: Severity;
  confidence: number; // 0-1
  location: string; // e.g. "Pier 3, west face"
  capturedAt: string;
  capturedBy: "web" | "mobile" | "uav" | "fixed-camera";
}

export interface Alert {
  id: string;
  structureId: string;
  structureName: string;
  detectionId: string;
  severity: Severity;
  message: string;
  createdAt: string;
  acknowledged: boolean;
}

/** Budget simulator — one ranked repair item derived from an alert + its forecast + structure criticality. */
export interface BudgetItem {
  structureId: string;
  structureName: string;
  detectionId: string;
  severity: Severity;
  priorityScore: number; // severity x urgency (inverse time-to-critical) x structure criticality
  estimatedCostUsd: number;
  projectedCriticalDate?: string;
}

export type Role = "inspector" | "engineer" | "admin" | "public-read";

/** Whoever the access cookie belongs to — the shape /api/auth/me returns. */
export interface SessionUser {
  userId: string;
  email: string;
  role: Role;
}

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

/**
 * What the inference service reports about itself.
 *
 * The admin page used to render a hardcoded table of model versions with
 * invented recall figures. Every field here comes from the live service, so
 * the page can only show what is actually loaded.
 */
export interface MlStatus {
  reachable: boolean;
  modelLoaded: boolean;
  modelVersion: string | null;
  serviceUrl: string;
  detail: string | null;
}

export interface ZoneRisk {
  zoneId: string;
  zoneName: string;
  lat: number;
  lng: number;
  aggregateRiskScore: number; // 0-100, weighted by structure count x severity
  structureCount: number;
}
