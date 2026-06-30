import type { FetchLike } from "./types";
import type { ConnectionType } from "@/lib/provider-connection-service";

/**
 * Linear GraphQL resource reads (teams + projects), read-only for display.
 *
 * The Authorization header DIFFERS by token type: an OAuth access token is sent
 * as `Bearer <token>`, but a Linear personal API key (the manual-token fallback)
 * is sent RAW with no `Bearer` prefix. Callers pass the connection type.
 */

export const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

export interface LinearTeamSummary {
  readonly id: string;
  readonly name: string;
}

export interface LinearProjectSummary {
  readonly id: string;
  readonly name: string;
}

/** Builds the provider-correct Authorization header for Linear. */
export function linearAuthHeader(
  token: string,
  connectionType: ConnectionType
): string {
  return connectionType === "oauth" ? `Bearer ${token}` : token;
}

/**
 * Executes a Linear GraphQL query and returns its `data` payload.
 * @throws On a non-OK response or GraphQL `errors`.
 */
export async function linearGraphql<T>(
  token: string,
  connectionType: ConnectionType,
  query: string,
  fetchImpl?: FetchLike
): Promise<T> {
  const f = fetchImpl ?? fetch;
  const res = await f(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: linearAuthHeader(token, connectionType),
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`Linear GraphQL request failed (${res.status}).`);
  }
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) {
    throw new Error("Linear GraphQL returned errors.");
  }
  return json.data as T;
}

/** Lists the workspace teams. Returns [] for no-team accounts. */
export async function listLinearTeams(
  token: string,
  connectionType: ConnectionType,
  fetchImpl?: FetchLike
): Promise<LinearTeamSummary[]> {
  const data = await linearGraphql<{ teams: { nodes: LinearTeamSummary[] } }>(
    token,
    connectionType,
    "{ teams { nodes { id name } } }",
    fetchImpl
  );
  return data.teams?.nodes ?? [];
}

/** Lists the workspace projects. Returns [] when there are none. */
export async function listLinearProjects(
  token: string,
  connectionType: ConnectionType,
  fetchImpl?: FetchLike
): Promise<LinearProjectSummary[]> {
  const data = await linearGraphql<{
    projects: { nodes: LinearProjectSummary[] };
  }>(token, connectionType, "{ projects { nodes { id name } } }", fetchImpl);
  return data.projects?.nodes ?? [];
}
