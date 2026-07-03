import net from "node:net";

/**
 * Port allocation + framework wiring for the live preview. The dev server must
 * bind to loopback on a port we control so we can build the preview URL and
 * embed it. We always set `PORT`/`HOST` env AND, for frameworks we recognize,
 * append their own port flag (belt and suspenders — some frameworks ignore env).
 */

/** Normalized framework kind used to pick how the port is passed to the dev server. */
export type PreviewFramework = "next" | "vite" | "cra" | "generic";

/** Attempts to bind `port` on `host`; resolves the port if free, else null. */
function probePort(port: number, host: string): Promise<number | null> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(null));
    srv.listen(port, host, () => {
      srv.close(() => resolve(port));
    });
  });
}

/** Binds an ephemeral port (OS-assigned) as a fallback. */
function ephemeralPort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, host, () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error("No free port"))));
    });
  });
}

/**
 * Finds a free port, preferring the configured fixed range (predictable URLs),
 * skipping ports already claimed by active previews, and falling back to an
 * OS-assigned ephemeral port when the whole range is busy.
 */
export async function getFreePort(opts: {
  host: string;
  rangeStart: number;
  rangeEnd: number;
  occupied?: ReadonlySet<number>;
}): Promise<number> {
  const { host, rangeStart, rangeEnd, occupied } = opts;
  for (let port = rangeStart; port <= rangeEnd; port++) {
    if (occupied?.has(port)) continue;
    const free = await probePort(port, host);
    if (free !== null) return free;
  }
  return ephemeralPort(host);
}

/**
 * Builds the extra CLI args that forward the port to a known framework's dev
 * server. Returned with a leading ` -- ` separator so it appends to a
 * package-manager script command (`pnpm dev` → `pnpm dev -- -p 4100 ...`).
 * Empty for CRA/unknown (env vars suffice / unknown scripts may reject flags).
 */
export function buildFrameworkPortArgs(
  framework: PreviewFramework,
  port: number,
  host: string
): string {
  switch (framework) {
    case "next":
      return ` -- -p ${port} -H ${host}`;
    case "vite":
      return ` -- --port ${port} --host ${host} --strictPort`;
    case "cra":
    case "generic":
    default:
      return "";
  }
}

/**
 * Builds the environment for the dev-server process: our port/host binding
 * first, then the user's pasted env vars (which win for everything EXCEPT
 * `PORT`/`HOST`, which we re-pin so the server always binds where we expect).
 */
export function buildPreviewEnv(opts: {
  base: NodeJS.ProcessEnv;
  port: number;
  host: string;
  userEnv: Record<string, string>;
}): NodeJS.ProcessEnv {
  const { base, port, host, userEnv } = opts;
  return {
    ...base,
    // User values win over the ambient environment...
    ...userEnv,
    // ...but never over the binding we control.
    PORT: String(port),
    HOST: host,
    HOSTNAME: host,
    BROWSER: "none", // stop CRA/others from trying to open a browser on the host
  };
}
