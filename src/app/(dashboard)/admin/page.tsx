"use client";

import { AlertTriangle, CheckCircle2, CircleSlash, ShieldAlert, Users as UsersIcon } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/common/QueryState";
import { useMlStatus, useSession, useSetUserRole, useUsers } from "@/hooks/use-vigileye-data";
import type { ApiError } from "@/lib/api-client";
import type { MlEngine, MlStatus, Role } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const ROLES: { value: Role; label: string; access: string }[] = [
  { value: "engineer", label: "Structural Engineer", access: "Register structures, full detail, trends, forecasts" },
  { value: "inspector", label: "Field Inspector", access: "Upload inspection media, view results" },
  { value: "public-read", label: "Municipal Safety Officer", access: "Map overview, alert inbox, repair briefs" },
  { value: "admin", label: "Admin", access: "Everything, plus user management" },
];

const ROLE_LABEL = new Map(ROLES.map((r) => [r.value, r.label]));

/**
 * Admin console.
 *
 * This page previously rendered a hardcoded table of model versions —
 * `yolov11-crack v1.3.0, recall 92.4%` and two more like it — for models that
 * had never been trained, alongside "Promote to active" buttons that only
 * fired a toast. Presenting invented accuracy figures as measurements is a
 * serious thing to do in a structural-safety tool, so the table is gone.
 *
 * What replaces it is what the inference service actually reports about
 * itself, including the honest answer when no model is loaded. The roles table
 * likewise now grants roles instead of describing them.
 */
export default function AdminPage() {
  const mlStatus = useMlStatus();
  const users = useUsers();
  const setUserRole = useSetUserRole();
  const { data: session } = useSession();

  // Two of the three cards here are role-gated at the API (`users` is
  // admin-only, `mlStatus` excludes public-read), and the sidebar links
  // everyone to this page. A bare "Couldn't load this data" for an engineer
  // who is simply not an admin reads as a broken deployment.
  const usersForbidden = (users.error as ApiError | null)?.status === 403;
  const mlForbidden = (mlStatus.error as ApiError | null)?.status === 403;

  return (
    <>
      <Topbar title="Admin" />
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Crack-detection model</CardTitle>
            <CardDescription>
              Read live from the inference service. Nothing on this card is hardcoded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mlStatus.isLoading ? (
              <LoadingRows rows={2} />
            ) : mlForbidden ? (
              <RoleNotice
                role={session?.role}
                requirement="Inference-service status is visible to inspectors, engineers and admins — it exposes the service URL, so read-only accounts are excluded."
              />
            ) : mlStatus.isError ? (
              <ErrorState message={(mlStatus.error as Error)?.message} onRetry={() => mlStatus.refetch()} />
            ) : mlStatus.data ? (
              <ModelStatusPanel status={mlStatus.data} />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles & access</CardTitle>
            <CardDescription>Enforced at the API on every request, not just in this UI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ROLES.map((r) => (
              <div
                key={r.value}
                className="flex items-center justify-between gap-4 border-b border-border/30 pb-2 last:border-0"
              >
                <span className="text-sm font-medium">{r.label}</span>
                <span className="text-right text-sm text-muted-foreground">{r.access}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>
              Signup always creates an inspector — nobody can make themselves an admin. Promote accounts here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {users.isLoading ? (
              <LoadingRows rows={4} />
            ) : usersForbidden ? (
              <RoleNotice
                role={session?.role}
                requirement="Only an admin can list accounts or change roles. If you need a role changed, ask someone who already has the admin role — the bootstrap admin is set by the backend's BOOTSTRAP_ADMIN_EMAIL."
              />
            ) : users.isError ? (
              <ErrorState message={(users.error as Error)?.message} onRetry={() => users.refetch()} />
            ) : !users.data?.length ? (
              <EmptyState icon={UsersIcon} title="No accounts yet" description="Nobody has signed up." />
            ) : (
              <div className="space-y-3">
                {users.data.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{u.name || u.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.name ? `${u.email} · ` : ""}joined {formatDate(u.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={u.role === "admin" ? "default" : "muted"}>
                        {ROLE_LABEL.get(u.role) ?? u.role}
                      </Badge>
                      <select
                        aria-label={`Role for ${u.email}`}
                        value={u.role}
                        disabled={setUserRole.isPending}
                        onChange={(e) => setUserRole.mutate({ id: u.id, role: e.target.value as Role })}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** A refusal the user can understand, in place of a generic failed-fetch. */
function RoleNotice({ role, requirement }: { role?: Role; requirement: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-severity-high/30 bg-severity-high/10 p-3 text-sm">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-severity-high" aria-hidden />
      <p className="text-muted-foreground">
        {role ? (
          <>
            Your account&apos;s role is <span className="font-medium capitalize text-foreground">{role}</span>.{" "}
          </>
        ) : null}
        {requirement}
      </p>
    </div>
  );
}

/** Plain-language names — "onnx" means nothing to a safety officer. */
const ENGINE_LABEL: Record<MlEngine, string> = {
  onnx: "Trained model (ONNX)",
  "opencv-heuristic": "Classical CV fallback",
  none: "None",
};

function ModelStatusPanel({
  status,
}: {
  status: MlStatus;
}) {
  // Three states, not two. "No trained model" and "nothing will answer an
  // upload" used to be the same thing; the classical-CV fallback separates
  // them, and telling a working service it is broken is its own kind of lie.
  const state = !status.reachable
    ? { icon: CircleSlash, label: "Unreachable", tone: "text-severity-critical" }
    : status.modelLoaded
      ? { icon: CheckCircle2, label: "Ready", tone: "text-severity-low" }
      : status.engine === "opencv-heuristic"
        ? { icon: AlertTriangle, label: "Fallback detector", tone: "text-severity-medium" }
        : { icon: AlertTriangle, label: "No model loaded", tone: "text-severity-high" };

  const Icon = state.icon;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${state.tone}`} aria-hidden />
        <span className="text-sm font-medium">{state.label}</span>
      </div>

      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Model version</dt>
        <dd>{status.modelVersion ?? "—"}</dd>
        <dt className="text-muted-foreground">Detector</dt>
        <dd>{ENGINE_LABEL[status.engine] ?? status.engine}</dd>
        <dt className="text-muted-foreground">Service</dt>
        <dd className="break-all font-mono text-xs">{status.serviceUrl}</dd>
      </dl>

      {status.detail && (
        <p className="rounded-md border border-border/40 bg-muted/40 p-3 text-xs text-muted-foreground">
          {status.detail}
        </p>
      )}

      {status.reachable && !status.modelLoaded && (
        <p className="text-xs text-muted-foreground">
          {status.engine === "opencv-heuristic"
            ? "Uploads are analysed, but by shape and contrast rather than a trained model — treat the results as indicative and verify them on site."
            : "Uploads will be rejected until weights are loaded."}{" "}
          There are no accuracy figures to show because no evaluated model exists yet — see{" "}
          <span className="font-mono">ml-model/ACCURACY.md</span>.
        </p>
      )}
    </div>
  );
}