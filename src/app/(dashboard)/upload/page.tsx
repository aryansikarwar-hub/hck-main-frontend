"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Building2, Upload as UploadIcon } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows } from "@/components/common/QueryState";
import { RegisterStructureDialog } from "@/components/structure/RegisterStructureDialog";
import { useInvalidateAfterIngest, useStructures } from "@/hooks/use-vigileye-data";
import { ingestImage, type IngestResult } from "@/lib/api-client";
import type { Detection } from "@/lib/types";
import { SEVERITY_COLOR_CLASS, SEVERITY_LABEL, cn } from "@/lib/utils";

/** Matches the backend's StorageService limit — reject oversized files here
 *  rather than after a slow upload that the API will refuse anyway. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function DetectionRow({ detection }: { detection: Detection }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium capitalize">{detection.crackType} crack</p>
        <p className="text-xs text-muted-foreground">
          {detection.widthMm}mm × {detection.lengthCm}cm · {Math.round(detection.confidence * 100)}% confidence
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-pill border px-2.5 py-0.5 text-xs font-medium",
          SEVERITY_COLOR_CLASS[detection.severity]
        )}
      >
        {SEVERITY_LABEL[detection.severity]}
      </span>
    </div>
  );
}

export default function UploadPage() {
  const { data: structures, isLoading, isError, error, refetch } = useStructures();
  const invalidateAfterIngest = useInvalidateAfterIngest();

  const [file, setFile] = useState<File | null>(null);
  const [structureId, setStructureId] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done">("idle");
  const [result, setResult] = useState<IngestResult | null>(null);

  // Default to the first real structure once the list arrives.
  useEffect(() => {
    if (!structureId && structures?.length) setStructureId(structures[0].id);
  }, [structures, structureId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !structureId || status === "uploading") return;

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 10MB.`);
      return;
    }

    setStatus("uploading");
    setResult(null);

    // The real request. ingestImage() POSTs multipart/form-data (field name
    // "file") to the same-origin /api/ingest/:structureId proxy, which adds
    // the bearer token and forwards to the NestJS API. It throws with a
    // human-readable message on network failure, non-2xx, or a 503 meaning
    // the ML service has no model loaded.
    const request = ingestImage(structureId, file);

    toast.promise(request, {
      loading: "Uploading and running crack detection…",
      success: (data: IngestResult) =>
        data.detections.length === 0
          ? "Analysis complete — no cracks detected in this image."
          : `Analysis complete — ${data.detections.length} detection${
              data.detections.length === 1 ? "" : "s"
            } recorded.`,
      error: (err: Error) => err.message || "Upload failed. Please try again.",
    });

    try {
      const data = await request;
      setResult(data);
      setStatus("done");
      setFile(null);
      // The upload wrote detections, changed the structure's risk level and
      // detection count, and may have raised an alert. Without this the
      // structure page serves its cached pre-upload copy for another 30s and
      // the new detection looks lost.
      invalidateAfterIngest(structureId);
    } catch {
      // The toast above already surfaced the message; just let the user retry.
      setStatus("idle");
    }
  }

  const selectedStructure = structures?.find((s) => s.id === structureId);

  return (
    <>
      <Topbar title="Upload for Inspection" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submit an image for crack detection</CardTitle>
              <CardDescription>
                Runs the same detection → severity → alert pipeline used by mobile and edge capture. Results are
                written to the structure&apos;s detection history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <LoadingRows rows={2} />
              ) : isError ? (
                <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
              ) : !structures || structures.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No structures registered yet"
                  description="An image can only be analysed against a registered structure — the detection has to be attached to something. Register one and the picker above will fill in."
                  action={<RegisterStructureDialog />}
                />
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="structure" className="mb-1 block text-sm font-medium">
                      Structure
                    </label>
                    <select
                      id="structure"
                      value={structureId}
                      onChange={(e) => setStructureId(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      {structures.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Image or video</label>
                    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors hover:bg-muted/60">
                      <UploadIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
                      <span className="text-sm text-muted-foreground">
                        {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)` : "Click to choose a file"}
                      </span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        disabled={status === "uploading"}
                        onChange={(e) => {
                          setFile(e.target.files?.[0] ?? null);
                          setResult(null);
                          setStatus("idle");
                        }}
                      />
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG or MP4 · up to 10MB</p>
                  </div>

                  <Button type="submit" disabled={!file || !structureId || status === "uploading"} className="w-full">
                    {status === "uploading" ? "Analysing…" : "Submit for analysis"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {result && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Analysis result</CardTitle>
                  <CardDescription>
                    model {result.modelVersion} · {Math.round(result.inferenceMs)}ms inference
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.detections.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      The model found no cracks above its confidence threshold in this image. Nothing was added to the
                      detection history.
                    </p>
                  ) : (
                    <>
                      {result.detections.map((d) => (
                        <DetectionRow key={d.id} detection={d} />
                      ))}
                      {selectedStructure && (
                        <Link
                          href={`/structures/${selectedStructure.id}`}
                          className="inline-block pt-1 text-sm font-medium text-primary hover:underline"
                        >
                          View {selectedStructure.name}&apos;s full detection history →
                        </Link>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </>
  );
}