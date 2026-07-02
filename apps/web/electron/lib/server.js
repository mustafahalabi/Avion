"use strict";

/**
 * Embedded Next.js server lifecycle.
 *
 * Production: spawns the standalone `server.js` using Electron's own Node
 * runtime (ELECTRON_RUN_AS_NODE) so there is no dependency on a system Node
 * install, then waits for the HTTP port to accept connections.
 *
 * Development: nothing is spawned here — `npm run electron:dev` starts
 * `next dev` separately and this module just waits for it to come up.
 */

const http = require("node:http");
const net = require("node:net");
const { spawn } = require("node:child_process");

const {
  isDev,
  HOST,
  APP_HOST,
  DEV_PORT,
  PREFERRED_PROD_PORT,
  standaloneServerEntry,
  standaloneDir,
  standaloneNodeModules,
} = require("./config");
const { buildChildEnv } = require("./env");

/** Resolves true if `port` is free to bind on the loopback interface. */
function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.close(() => resolve(true));
      })
      .listen(port, HOST);
  });
}

/** Finds a bindable port, preferring `preferred` then scanning upward. */
async function resolvePort(preferred) {
  for (let port = preferred; port < preferred + 50; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found near ${preferred}`);
}

/** Polls until the server answers an HTTP request or the timeout elapses. */
function waitForServer(url, { timeoutMs = 30000, intervalMs = 300 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Server did not become ready at ${url}`));
          return;
        }
        setTimeout(attempt, intervalMs);
      });
      req.setTimeout(2000, () => req.destroy());
    };
    attempt();
  });
}

/**
 * Starts the embedded server (prod) or attaches to the dev server.
 *
 * @param {object} opts
 * @param {string} opts.dbPath        Writable SQLite path for the server.
 * @param {(source: string, msg: string) => void} [opts.onLog]
 * @param {(code: number|null, signal: string|null) => void} [opts.onUnexpectedExit]
 *        Called if the server child dies AFTER a successful startup.
 * @returns {Promise<{ baseUrl: string, port: number, dbPath: string, stop: () => Promise<void> }>}
 */
async function startServer({ dbPath, onLog, onUnexpectedExit }) {
  if (isDev) {
    const port = DEV_PORT;
    // Load via localhost (Clerk-friendly); `next dev` serves it.
    const baseUrl = `http://${APP_HOST}:${port}`;
    await waitForServer(`${baseUrl}/`, { timeoutMs: 60000 });
    return { baseUrl, port, dbPath, stop: async () => {} };
  }

  const port = await resolvePort(PREFERRED_PROD_PORT);
  if (port !== PREFERRED_PROD_PORT) {
    // The origin is pinned so OAuth callback URLs / Clerk origins stay stable —
    // a shifted port silently breaks them. Make it loud.
    onLog?.(
      "server",
      `WARNING: preferred port ${PREFERRED_PROD_PORT} was busy; using ${port}. ` +
        `OAuth/Clerk redirect origins assume ${PREFERRED_PROD_PORT} and may fail. ` +
        `Free the port or set EOS_APP_PORT.`
    );
  }
  // The window + OAuth use localhost (Clerk-friendly); the server binds to HOST
  // (127.0.0.1, set via HOSTNAME in buildChildEnv) and readiness polls it.
  const baseUrl = `http://${APP_HOST}:${port}`;
  const readyUrl = `http://${HOST}:${port}`;
  const env = buildChildEnv({
    dbPath,
    baseUrl,
    port,
    nodePath: standaloneNodeModules(),
  });

  const child = spawn(process.execPath, [standaloneServerEntry()], {
    cwd: standaloneDir(),
    env: {
      ...env,
      // Make Electron's binary behave as plain Node for this child.
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (d) => onLog?.("server", d.toString()));
  child.stderr.on("data", (d) => onLog?.("server", d.toString()));

  let exited = false;
  let ready = false;
  let stopping = false;
  child.on("exit", (code, signal) => {
    exited = true;
    onLog?.("server", `exited (code=${code} signal=${signal})`);
    // A crash AFTER startup (not during shutdown) leaves the window on a dead
    // origin — surface it so the UI doesn't just hang.
    if (ready && !stopping) onUnexpectedExit?.(code, signal);
  });

  await waitForServer(`${readyUrl}/`, { timeoutMs: 45000 });
  ready = true;

  const stop = () => {
    stopping = true;
    return runStop();
  };
  const runStop = () =>
    new Promise((resolve) => {
      if (exited || child.killed) return resolve();
      child.once("exit", () => resolve());
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!exited) child.kill("SIGKILL");
        resolve();
      }, 5000);
    });

  return { baseUrl, port, dbPath, stop };
}

module.exports = { startServer, waitForServer, resolvePort };
