import { GraphQLClient } from "graphql-request";
import type { Detection } from "@/lib/types";

/**
 * Whether a backend has been configured for this build.
 *
 * NEXT_PUBLIC_API_URL is inlined at build time, so this is a build-time fact,
 * not a runtime one — changing the variable on Vercel requires a redeploy.
 *
 * There is deliberately NO mock-data fallback behind this flag. An earlier
 * version of this file exported `USE_MOCKS = !process.env.NEXT_PUBLIC_API_URL`
 * and the dashboard silently rendered fixtures whenever the variable was
 * missing, which is indistinguishable from real monitoring data — dangerous
 * for a structural-safety tool. The flag now only drives a visible warning
 * banner (see components/common/DataSourceBanner.tsx); when the API is not
 * configured, queries fail loudly instead of inventing data.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/graphql\/?$/, "").replace(/\/+$/, "");
export const IS_API_CONFIGURED = API_BASE_URL.length > 0;

/** Same-origin proxy route that adds the bearer token server-side. */
const GRAPHQL_PATH = "/api/graphql";

let client: GraphQLClient | null = null;

/**
 * All GraphQL traffic goes through the same-origin /api/graphql proxy, which
 * attaches the bearer token server-side from the httpOnly cookie. The browser
 * therefore never holds a credential, and there is no Authorization header to
 * construct here.
 *
 * The client is built lazily with an ABSOLUTE url. graphql-request v7 runs
 * `new URL(params.url)` on every request (build/legacy/helpers/runRequest.js),
 * and that constructor rejects a bare path — passing "/api/graphql" throws
 * `Failed to construct 'URL': Invalid URL` before a single request leaves the
 * browser, which surfaced as "Couldn't load this data" on every dashboard
 * page. Resolving against window.location.origin keeps the request
 * same-origin while giving the library the absolute url it requires.
 *
 * Lazy, not module-scope, because `window` does not exist while Next
 * prerenders these pages at build time.
 */
export function getGqlClient(): GraphQLClient {
  if (client) return client;

  const endpoint =
    typeof window === "undefined"
      ? // Never actually used: every caller is a client component. Present
        // only so module evaluation during prerender cannot throw.
        `http://localhost${GRAPHQL_PATH}`
      : new URL(GRAPHQL_PATH, window.location.origin).toString();

  client = new GraphQLClient(endpoint, {
    // Cookies are same-origin to the proxy route.
    credentials: "same-origin",
  });
  return client;
}

/**
 * In-flight refresh, shared by every caller.
 *
 * The access cookie lives 15 minutes; the refresh cookie lives 30 days. The
 * /api/auth/refresh route that trades one for the other existed but nothing
 * ever called it — so 15 minutes after signing in, every query started
 * returning 401 and the whole dashboard died with "Your session has expired"
 * even though the session was perfectly renewable. Middleware still let the
 * user in (it accepts either cookie), which made it look like a server fault
 * rather than an expired token.
 *
 * Single-flight matters: a dashboard page fires several queries at once, and
 * without this they would each POST a refresh and race to rotate the tokens.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  refreshInFlight ??= fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

function authError(message: string, status: number): Error {
  const err = new Error(message);
  (err as Error & { status?: number }).status = status;
  return err;
}

/** Sends the user back to login, preserving where they were. */
function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

/**
 * Thin wrapper that turns GraphQL/HTTP failures into something the query
 * layer can branch on (see Providers: 401/403 are never retried).
 *
 * A 401 triggers one silent refresh-and-retry before giving up, so a normally
 * expired access token is invisible to the user.
 */
export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  { allowRefresh = true }: { allowRefresh?: boolean } = {}
): Promise<T> {
  try {
    return await getGqlClient().request<T>(query, variables);
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;

    if (status === 401) {
      if (allowRefresh && (await refreshSession())) {
        // New access cookie is set — replay the query once.
        return gql<T>(query, variables, { allowRefresh: false });
      }
      redirectToLogin();
      throw authError("Your session has expired. Please sign in again.", 401);
    }

    if (status === 403) {
      throw authError("You don't have permission to view this.", 403);
    }

    throw error;
  }
}

export const QUERIES = {
  structures: /* GraphQL */ `
    query Structures($riskLevel: Severity, $type: StructureType, $zoneId: String) {
      structures(riskLevel: $riskLevel, type: $type, zoneId: $zoneId) {
        id
        name
        type
        lat
        lng
        riskLevel
        lastInspected
        activeDetections
        criticalityWeight
        zoneId
      }
    }
  `,

  alerts: /* GraphQL */ `
    query Alerts($limit: Int, $offset: Int) {
      alerts(limit: $limit, offset: $offset) {
        totalCount
        hasMore
        items {
          id
          structureId
          structureName
          detectionId
          severity
          message
          createdAt
          acknowledged
        }
      }
    }
  `,

  /**
   * Live state of the inference service, for the admin page. Replaces a
   * hardcoded table of model versions whose recall figures were invented.
   */
  mlStatus: /* GraphQL */ `
    query MlStatus {
      mlStatus {
        reachable
        modelLoaded
        modelVersion
        serviceUrl
        detail
      }
    }
  `,

  users: /* GraphQL */ `
    query Users {
      users {
        id
        email
        name
        role
        createdAt
      }
    }
  `,

  structureDetail: /* GraphQL */ `
    query StructureDetail($id: ID!) {
      structure(id: $id) {
        id
        name
        type
        lat
        lng
        riskLevel
        lastInspected
        activeDetections
        criticalityWeight
        zoneId
        detections {
          id
          structureId
          crackType
          widthMm
          lengthCm
          severity
          confidence
          location
          capturedAt
          capturedBy
          imageUrl
          annotatedImageUrl
        }
      }
    }
  `,
};

/** Shape returned by the backend's POST /api/ingest/:structureId. */
export interface IngestResult {
  modelVersion: string;
  inferenceMs: number;
  detections: Detection[];
}

/**
 * Uploads one image/video for crack detection.
 *
 * Posts same-origin to /api/ingest/:structureId — the Next route handler that
 * attaches the bearer token from the httpOnly cookie and forwards to the API.
 * Content-Type is deliberately NOT set: the browser must generate the
 * multipart boundary itself.
 */
export async function ingestImage(
  structureId: string,
  file: File,
  { allowRefresh = true }: { allowRefresh?: boolean } = {}
): Promise<IngestResult> {
  const form = new FormData();
  // Field name must be "file" — see backend FileInterceptor("file").
  form.append("file", file, file.name);

  let res: Response;
  try {
    res = await fetch(`/api/ingest/${encodeURIComponent(structureId)}`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Network error — the upload never reached the server. Check your connection and try again.");
  }

  // Same refresh-and-retry as gql(): an expired access token should not cost
  // the user their upload.
  if (res.status === 401 && allowRefresh && (await refreshSession())) {
    return ingestImage(structureId, file, { allowRefresh: false });
  }

  const payload = (await res.json().catch(() => null)) as
    | (IngestResult & { error?: { message?: string } })
    | null;

  if (!res.ok) {
    throw new Error(payload?.error?.message ?? `Upload failed (HTTP ${res.status}).`);
  }
  if (!payload || !Array.isArray(payload.detections)) {
    throw new Error("The analysis service returned an unexpected response.");
  }

  return payload;
}

/** Fields shared by every mutation that returns a Structure. */
const STRUCTURE_FIELDS = /* GraphQL */ `
  id
  name
  type
  lat
  lng
  riskLevel
  lastInspected
  activeDetections
  criticalityWeight
  zoneId
`;

export const MUTATIONS = {
  acknowledgeAlert: /* GraphQL */ `
    mutation AcknowledgeAlert($id: ID!) {
      acknowledgeAlert(id: $id) {
        id
        acknowledged
      }
    }
  `,

  createStructure: /* GraphQL */ `
    mutation CreateStructure($input: CreateStructureInput!) {
      createStructure(input: $input) { ${STRUCTURE_FIELDS} }
    }
  `,

  updateStructure: /* GraphQL */ `
    mutation UpdateStructure($id: ID!, $input: UpdateStructureInput!) {
      updateStructure(id: $id, input: $input) { ${STRUCTURE_FIELDS} }
    }
  `,

  deleteStructure: /* GraphQL */ `
    mutation DeleteStructure($id: ID!) {
      deleteStructure(id: $id)
    }
  `,

  setUserRole: /* GraphQL */ `
    mutation SetUserRole($id: ID!, $role: String!) {
      setUserRole(id: $id, role: $role) {
        id
        email
        name
        role
        createdAt
      }
    }
  `,
};