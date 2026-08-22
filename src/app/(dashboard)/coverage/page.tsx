"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { MapPinOff, Users } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingRows } from "@/components/common/QueryState";
import { RegisterStructureDialog } from "@/components/structure/RegisterStructureDialog";
import { useStructures } from "@/hooks/use-vigileye-data";
import { cn, daysSince, formatDate } from "@/lib/utils";

/**
 * An unknown last-inspected date is treated as the worst case, not the best.
 * It previously fell through to the green "recent" bucket, because `daysSince`
 * returned NaN and every `NaN > n` comparison is false — so a structure with
 * no inspection record on file was shown as freshly surveyed.
 */
function stalenessColor(days: number | null): string {
  if (days === null || days > 60) return "bg-severity-critical/15 text-severity-critical border-severity-critical/30";
  if (days > 30) return "bg-severity-medium/15 text-severity-medium border-severity-medium/30";
  return "bg-severity-low/15 text-severity-low border-severity-low/30";
}

/**
 * Field-inspector persona: which structures haven't been surveyed recently.
 *
 * Staleness is computed from each structure's real `lastInspected` date.
 *
 * The inspector leaderboard that used to sit below this was rendered from a
 * fixtures array (`mockInspectors`) — invented people with invented survey
 * counts, shown as if they were the team's actual figures. The API exposes no
 * per-inspector survey data, so rather than keep fabricating it, the section
 * states plainly that the data source does not exist yet.
 */
export default function CoveragePage() {
  const { data: structures, isLoading, isError, error, refetch } = useStructures();

  // Sorted stalest-first, with unknown dates ahead of everything: they are the
  // entries most in need of a visit, not the least. A finite sentinel rather
  // than Infinity, so two unknowns compare equal instead of yielding NaN.
  const staleness = useMemo(() => {
    const rank = (iso: string) => daysSince(iso) ?? Number.MAX_SAFE_INTEGER;
    return [...(structures ?? [])].sort((a, b) => rank(b.lastInspected) - rank(a.lastInspected));
  }, [structures]);

  return (
    <>
      <Topbar title="Inspector Coverage" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingRows rows={5} />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
        ) : staleness.length === 0 ? (
          <EmptyState
            icon={MapPinOff}
            title="No structures registered yet"
            description="Survey staleness is calculated per structure. Register a structure to start tracking how long it has been since its last inspection."
            action={<RegisterStructureDialog />}
          />
        ) : (
          <div className="space-y-6 p-6">
            <Card>
              <CardHeader>
                <CardTitle>Survey staleness</CardTitle>
                <CardDescription>
                  Structures ranked by days since last inspection — the longer the gap, the higher the risk of an
                  unnoticed crack. A structure registered without an inspection date is dated from its
                  registration, so a fresh &ldquo;0d&rdquo; here means recently added, not recently surveyed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {staleness.map((s, i) => {
                  const days = daysSince(s.lastInspected);
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 10) * 0.05 }}
                      className="flex items-center justify-between rounded-lg border border-border/40 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {s.type} · last surveyed {formatDate(s.lastInspected)}
                        </p>
                      </div>
                      <span className={cn("rounded-pill border px-2.5 py-0.5 text-xs font-medium", stalenessColor(days))}>
                        {days === null ? "never surveyed" : `${days}d ago`}
                      </span>
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inspector leaderboard</CardTitle>
                <CardDescription>Surveys completed per inspector</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 rounded-lg border border-dashed border-border/60 p-4">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    Not available yet — the API does not record which inspector performed each survey. This panel will
                    populate once uploads are attributed to a user and an inspections query is exposed.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}