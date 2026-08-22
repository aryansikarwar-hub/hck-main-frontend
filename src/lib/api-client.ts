import { GraphQLClient } from "graphql-request";

/**
 * All GraphQL traffic goes through the same-origin /api/graphql proxy, which
 * attaches the bearer token server-side from the httpOnly cookie. The browser
 * therefore never holds a credential, and there is no Authorization header to
 * construct here.
 */
export const gqlClient = new GraphQLClient("/api/graphql", {
  // Cookies are same-origin to the proxy route.
  credentials: "same-origin",
});

/** Thin wrapper that turns GraphQL/HTTP failures into something the query
 *  layer can branch on (see Providers: 401/403 are never retried). */
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  try {
    return await gqlClient.request<T>(query, variables);
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401) {
      const err = new Error("Your session has expired. Please sign in again.");
      (err as Error & { status?: number }).status = 401;
      throw err;
    }
    if (status === 403) {
      const err = new Error("You don't have permission to view this.");
      (err as Error & { status?: number }).status = 403;
      throw err;
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

export const MUTATIONS = {
  acknowledgeAlert: /* GraphQL */ `
    mutation AcknowledgeAlert($id: ID!) {
      acknowledgeAlert(id: $id) {
        id
        acknowledged
      }
    }
  `,
};
