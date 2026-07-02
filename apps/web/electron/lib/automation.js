"use strict";

/**
 * Optional background automation (the execution worker + scheduler driver).
 *
 * These power Avion's autonomous outcome→PR loop. They are OFF by
 * default in the desktop app because they require external tooling that is not
 * guaranteed on an end-user machine (the `claude` CLI, git, GitHub tokens).
 * They can be toggled from the application menu, or auto-started by setting
 * EOS_RUN_AUTOMATION=1.
 *
 * In production the worker/driver run from esbuild-produced CJS bundles
 * (`worker.js` / `driver.js` under resources) using Electron's Node runtime,
 * resolving the native better-sqlite3 from the standalone bundle. In dev they
 * run from source via `tsx`.
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

const { isDev, automationBundle, standaloneNodeModules } = require("./config");
const { buildChildEnv } = require("./env");

let processes = [];
let running = false;

/** Whether the worker/driver are currently running. */
function isRunning() {
  return running;
}

/** Spawns one automation child (prod bundle or dev tsx entry). */
function spawnOne(kind, { dbPath, onLog }) {
  const env = buildChildEnv({ dbPath, nodePath: standaloneNodeModules() });

  let command;
  let args;
  let cwd;

  if (isDev) {
    // From source: src/worker/index.ts (worker) or src/worker/driver.ts (driver).
    const entry =
      kind === "worker" ? "src/worker/index.ts" : "src/worker/driver.ts";
    command = process.execPath; // node, running tsx's CLI
    args = [require.resolve("tsx/cli"), entry];
    cwd = path.join(__dirname, "..", "..");
  } else {
    command = process.execPath; // Electron-as-Node
    args = [automationBundle(`${kind}.js`)];
    cwd = path.dirname(automationBundle(`${kind}.js`));
    env.ELECTRON_RUN_AS_NODE = "1";
  }

  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (d) => onLog?.(kind, d.toString()));
  child.stderr.on("data", (d) => onLog?.(kind, d.toString()));
  child.on("exit", (code, signal) =>
    onLog?.(kind, `exited (code=${code} signal=${signal})`)
  );
  return child;
}

/** Starts the worker + driver if not already running. */
function startAutomation({ dbPath, onLog }) {
  if (running) return;
  processes = [
    spawnOne("worker", { dbPath, onLog }),
    spawnOne("driver", { dbPath, onLog }),
  ];
  running = true;
  onLog?.("automation", "started worker + driver");
}

/** Stops any running automation children. */
async function stopAutomation({ onLog } = {}) {
  if (!running) return;
  const current = processes;
  processes = [];
  running = false;
  await Promise.all(
    current.map(
      (child) =>
        new Promise((resolve) => {
          if (child.killed || child.exitCode !== null) return resolve();
          child.once("exit", () => resolve());
          child.kill("SIGTERM");
          setTimeout(() => {
            if (child.exitCode === null) child.kill("SIGKILL");
            resolve();
          }, 5000);
        })
    )
  );
  onLog?.("automation", "stopped");
}

module.exports = { isRunning, startAutomation, stopAutomation };
