"use strict";

/**
 * Avion — Electron main process.
 *
 * Boots the full Next.js application as a local desktop app:
 *   1. Ensure a writable per-user SQLite database (seeded from the shipped
 *      schema template on first run).
 *   2. Start the embedded Next.js server (standalone build in production; an
 *      already-running `next dev` in development).
 *   3. Open a window onto it and install the native menu.
 *   4. Optionally run the autonomous worker + driver in the background.
 *
 * See docs/ELECTRON.md for the full architecture and packaging story.
 */

const { app, dialog } = require("electron");

const { isDev, APP_HOST, devDatabasePath } = require("./lib/config");
const { ensureUserDatabase } = require("./lib/database");
const { startServer } = require("./lib/server");
const { createMainWindow, installNavigationGuards } = require("./lib/window");
const { buildMenu } = require("./lib/menu");
const automation = require("./lib/automation");

/** @type {{ baseUrl: string, port: number, dbPath: string, stop: () => Promise<void> } | null} */
let server = null;
/** @type {Electron.BrowserWindow | null} */
let mainWindow = null;
let isQuitting = false;

/** Simple namespaced logger for child-process output. */
function log(source, message) {
  const text = String(message).trimEnd();
  if (text) console.log(`[${source}] ${text}`);
}

/** Rebuilds the menu so the automation toggle label reflects current state. */
function refreshMenu() {
  buildMenu({
    isAutomationRunning: () => automation.isRunning(),
    onToggleAutomation: () => toggleAutomation(),
    getUserDataDir: () => app.getPath("userData"),
    getDbPath: () => server?.dbPath ?? "(starting…)",
  });
}

/** Starts/stops the worker + driver and refreshes the menu label. */
function toggleAutomation() {
  if (!server) return;
  if (automation.isRunning()) {
    void automation.stopAutomation({ onLog: log }).then(refreshMenu);
  } else {
    automation.startAutomation({ dbPath: server.dbPath, onLog: log });
    refreshMenu();
  }
}

/** Full startup sequence; surfaces a dialog and exits on fatal failure. */
async function bootstrap() {
  // In dev the UI is served by `next dev`, which uses the repo's prisma/dev.db;
  // share that file so the shell + server + any automation see one database and
  // no schema template is required to iterate on the shell.
  let dbPath;
  if (isDev) {
    dbPath = devDatabasePath();
    log("db", `dev mode — using ${dbPath}`);
  } else {
    try {
      const db = ensureUserDatabase();
      dbPath = db.path;
      log("db", db.created ? `initialised at ${db.path}` : `using ${db.path}`);
    } catch (err) {
      dialog.showErrorBox(
        "Avion — database error",
        `Could not prepare the database.\n\n${err.message}`
      );
      app.quit();
      return;
    }
  }

  try {
    server = await startServer({
      dbPath,
      onLog: log,
      onUnexpectedExit: (code, signal) => {
        if (isQuitting) return;
        dialog.showErrorBox(
          "Avion — server stopped",
          `The application server stopped unexpectedly (code=${code} signal=${signal}). The app will close.`
        );
        app.quit();
      },
    });
    log("server", `ready at ${server.baseUrl}`);
  } catch (err) {
    dialog.showErrorBox(
      "Avion — server error",
      `The application server failed to start.\n\n${err.message}\n\n` +
        (isDev
          ? `In development, make sure \`next dev\` is running on ${APP_HOST}:3000 ` +
            `(use \`npm run electron:dev\`).`
          : "")
    );
    app.quit();
    return;
  }

  // Apply the navigation/window-open policy to EVERY webContents (the main
  // window and any auth popups it spawns), not just the first one.
  const appOrigin = new URL(server.baseUrl).origin;
  app.on("web-contents-created", (_event, contents) => {
    installNavigationGuards(contents, appOrigin);
  });

  mainWindow = createMainWindow({ baseUrl: server.baseUrl });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  refreshMenu();

  if (process.env.EOS_RUN_AUTOMATION === "1") {
    automation.startAutomation({ dbPath: server.dbPath, onLog: log });
    refreshMenu();
  }
}

// ── Single-instance lock ─────────────────────────────────────────────────────
// A second SQLite writer (or server) would race the first; focus the existing
// window instead of launching a duplicate.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(bootstrap);

  app.on("activate", () => {
    // macOS: re-open a window when the dock icon is clicked and none are open.
    if (!mainWindow && server) {
      mainWindow = createMainWindow({ baseUrl: server.baseUrl });
      mainWindow.on("closed", () => {
        mainWindow = null;
      });
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  // ── Graceful teardown ──────────────────────────────────────────────────────
  app.on("before-quit", async (event) => {
    // Always hold the quit until teardown finishes. A second quit during the
    // async shutdown window must not slip through and orphan the server/worker
    // children (which would keep the port + SQLite handle held).
    event.preventDefault();
    if (isQuitting) return;
    isQuitting = true;
    log("app", "shutting down…");
    try {
      await automation.stopAutomation({ onLog: log });
      await server?.stop();
    } catch (err) {
      log("app", `shutdown error: ${err.message}`);
    }
    app.exit(0);
  });
}
