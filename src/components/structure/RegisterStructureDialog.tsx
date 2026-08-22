"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateStructure } from "@/hooks/use-vigileye-data";
import type { Structure } from "@/lib/types";

const STRUCTURE_TYPES: Structure["type"][] = ["bridge", "dam", "building", "tunnel"];

const CRITICALITY = [
  { value: 1, label: "1 — Low", hint: "Redundant route, low traffic, few people affected" },
  { value: 2, label: "2 — Medium", hint: "Meaningful disruption if it fails" },
  { value: 3, label: "3 — High", hint: "No redundancy, heavy traffic or large population served" },
];

/**
 * Registers a real structure to monitor.
 *
 * Until this existed the map could only ever show SeedService's five
 * fictional San Francisco structures — the GraphQL API had no create mutation
 * at all, so there was no way to put a real bridge on the map from the app.
 *
 * Requires the engineer or admin role (see StructuresResolver). An inspector
 * hitting this gets a 403 with a message saying so, rather than a silent
 * no-op.
 */
export function RegisterStructureDialog() {
  const [open, setOpen] = useState(false);
  const createStructure = useCreateStructure();

  // Controlled because the dialog unmounts its children on close, and a
  // half-filled form should not survive to the next open.
  const [name, setName] = useState("");
  const [type, setType] = useState<Structure["type"]>("bridge");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [criticalityWeight, setCriticalityWeight] = useState(1);

  function reset() {
    setName("");
    setType("bridge");
    setLat("");
    setLng("");
    setZoneId("");
    setCriticalityWeight(1);
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);
  // Blank strings coerce to 0, which is a valid coordinate — so check the
  // raw text is non-empty as well as numeric.
  const latValid = lat.trim() !== "" && Number.isFinite(latNum) && Math.abs(latNum) <= 90;
  const lngValid = lng.trim() !== "" && Number.isFinite(lngNum) && Math.abs(lngNum) <= 180;
  const canSubmit = name.trim().length >= 2 && latValid && lngValid && !createStructure.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      await createStructure.mutateAsync({
        name: name.trim(),
        type,
        lat: latNum,
        lng: lngNum,
        criticalityWeight,
        // Omitted rather than sent empty: the API defaults it to "unzoned",
        // and the slug validator would reject "".
        ...(zoneId.trim() ? { zoneId: zoneId.trim() } : {}),
      });
      reset();
      setOpen(false);
    } catch {
      // useCreateStructure already surfaced the message as a toast; keep the
      // dialog open with the values intact so the user can correct them.
    }
  }

  /** Fills the coordinates from the browser, for registering where you stand. */
  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      () => {
        /* Denied or unavailable — the fields stay editable by hand. */
      }
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" aria-hidden />
          Register structure
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a structure</DialogTitle>
          <DialogDescription>
            It appears on the map immediately and becomes a valid target for inspection uploads.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="structure-name" className="mb-1 block text-sm font-medium">
              Name
            </label>
            <Input
              id="structure-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Howrah Bridge"
              required
              minLength={2}
              maxLength={120}
            />
          </div>

          <div>
            <label htmlFor="structure-type" className="mb-1 block text-sm font-medium">
              Type
            </label>
            <select
              id="structure-type"
              value={type}
              onChange={(e) => setType(e.target.value as Structure["type"])}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm capitalize"
            >
              {STRUCTURE_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="structure-lat" className="mb-1 block text-sm font-medium">
                Latitude
              </label>
              <Input
                id="structure-lat"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="22.585"
                inputMode="decimal"
                required
              />
              {lat.trim() !== "" && !latValid && (
                <p className="mt-1 text-xs text-severity-critical">Must be a number between -90 and 90.</p>
              )}
            </div>
            <div>
              <label htmlFor="structure-lng" className="mb-1 block text-sm font-medium">
                Longitude
              </label>
              <Input
                id="structure-lng"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="88.347"
                inputMode="decimal"
                required
              />
              {lng.trim() !== "" && !lngValid && (
                <p className="mt-1 text-xs text-severity-critical">Must be a number between -180 and 180.</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={useMyLocation}
            className="text-xs font-medium text-primary hover:underline"
          >
            Use my current location
          </button>

          <div>
            <label htmlFor="structure-criticality" className="mb-1 block text-sm font-medium">
              Criticality
            </label>
            <select
              id="structure-criticality"
              value={criticalityWeight}
              onChange={(e) => setCriticalityWeight(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {CRITICALITY.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {CRITICALITY.find((c) => c.value === criticalityWeight)?.hint}
            </p>
          </div>

          <div>
            <label htmlFor="structure-zone" className="mb-1 block text-sm font-medium">
              Zone <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="structure-zone"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              placeholder="zone-north-bay"
              maxLength={60}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase slug. Structures sharing a zone are aggregated on the risk heatmap.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Risk level starts at <span className="font-medium">low</span> — no inspection has happened yet. The
            first analysed upload sets it from what the model actually finds.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              {createStructure.isPending ? "Registering…" : "Register"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
