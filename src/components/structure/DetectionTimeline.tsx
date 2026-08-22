"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ImageOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Detection } from "@/lib/types";
import { SEVERITY_COLOR_CLASS, SEVERITY_LABEL, cn, formatDate } from "@/lib/utils";

/**
 * The captured frame for a detection.
 *
 * Prefers the annotated version (the one with the crack outlined) because
 * that is the evidence for the flag; falls back to the raw capture. Both
 * timeline thumbnails and the detail dialog used to render a bare
 * `bg-muted` block here, so a real photograph the API had already returned
 * was displayed as an empty grey rectangle.
 *
 * A plain <img>, not next/image: these are Cloudinary URLs from the backend
 * (StorageService returns `secure_url`), and next/image would 400 on any host
 * missing from next.config.js's remotePatterns — turning a working photo into
 * a broken one whenever storage is reconfigured.
 */
export function DetectionImage({
  detection,
  className,
}: {
  detection: Detection;
  className?: string;
}) {
  const src = detection.annotatedImageUrl || detection.imageUrl;
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/60 bg-muted/40 p-2 text-center",
          className
        )}
      >
        <ImageOff className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-[10px] leading-tight text-muted-foreground">
          {src ? "Image unavailable" : "No image stored"}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary storage host, see note above
    <img
      src={src}
      alt={`${detection.crackType} crack at ${detection.location}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("rounded-md border border-border/40 object-cover", className)}
    />
  );
}

export function DetectionTimeline({
  detections,
  onSelect,
}: {
  detections: Detection[];
  onSelect?: (detection: Detection) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {detections.map((d, i) => (
        <motion.div
          key={d.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          // Capped so a structure with a long history doesn't leave the last
          // rows invisible for several seconds.
          transition={{ delay: Math.min(i, 8) * 0.06 }}
        >
          <Card
            className={cn("transition-colors", onSelect && "cursor-pointer hover:bg-muted")}
            onClick={() => onSelect?.(d)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <DetectionImage detection={d} className="h-16 w-16 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-pill border px-2 py-0.5 text-xs font-medium", SEVERITY_COLOR_CLASS[d.severity])}>
                    {SEVERITY_LABEL[d.severity]}
                  </span>
                  <span className="text-sm font-medium capitalize">{d.crackType} crack</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {d.location} · {d.widthMm}mm × {d.lengthCm}cm · {Math.round(d.confidence * 100)}% confidence
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(d.capturedAt)} · captured via {d.capturedBy}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
