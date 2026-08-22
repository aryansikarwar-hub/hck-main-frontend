import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Severity } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const SEVERITY_COLOR_CLASS: Record<Severity, string> = {
  low: "bg-severity-low/15 text-severity-low border-severity-low/30",
  medium: "bg-severity-medium/15 text-severity-medium border-severity-medium/30",
  high: "bg-severity-high/15 text-severity-high border-severity-high/30",
  critical: "bg-severity-critical/15 text-severity-critical border-severity-critical/30",
};

const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];

/**
 * Coerces anything severity-shaped into a valid Severity.
 *
 * The API serialises its enums by KEY, not value — NestJS `registerEnumType`
 * turns `Severity.MEDIUM = "medium"` into the wire value "MEDIUM". Hooks
 * normalise incoming data at the boundary (see use-vigileye-data.ts), but the
 * severity tables are indexed all over the UI and a single unrecognised value
 * used to take down an entire route: `SEVERITY_COLOR_CLASS[x]` returned
 * undefined and `.split(" ")` on it threw. This makes that impossible.
 */
export function normalizeSeverity(value: unknown): Severity {
  const candidate = String(value ?? "").toLowerCase();
  return (SEVERITIES as string[]).includes(candidate) ? (candidate as Severity) : "low";
}

/** Full badge classes (background + text + border) for any severity value. */
export function severityClasses(value: unknown): string {
  return SEVERITY_COLOR_CLASS[normalizeSeverity(value)];
}

/** Just the `text-severity-*` class — the safe replacement for the old
 *  `SEVERITY_COLOR_CLASS[x].split(" ")[1]`, which threw on unknown values. */
export function severityTextClass(value: unknown): string {
  return `text-severity-${normalizeSeverity(value)}`;
}

/** Just the `bg-severity-*` class, at full opacity. */
export function severityBgClass(value: unknown): string {
  return `bg-severity-${normalizeSeverity(value)}`;
}

/** Human label for any severity value. */
export function severityLabel(value: unknown): string {
  return SEVERITY_LABEL[normalizeSeverity(value)];
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}