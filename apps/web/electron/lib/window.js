"use strict";

/**
 * Main application window creation and navigation policy.
 *
 * Security posture: context isolation on, node integration off, sandboxed
 * renderer. Navigation policy (installNavigationGuards) is applied to EVERY
 * webContents — including auth popups and any window they spawn — via
 * `web-contents-created` in main.js, not just the main window:
 *   - top-level navigation away from the app origin is bounced to the OS
 *     browser (safe schemes only);
 *   - window.open is allowed only for the app origin and an exact, suffix-
 *     anchored auth-host allowlist (so OAuth sign-in works) — everything else
 *     opens externally;
 *   - <webview> embedding is denied.
 */

const path = require("node:path");
const { BrowserWindow, shell } = require("electron");

const { isDev } = require("./config");

/**
 * Exact / suffix-anchored allowlist of identity-provider hosts that may load
 * inside the app window — Clerk's own pages plus the OAuth providers Clerk
 * federates to. Keeping these in-app (rather than bouncing them to the system
 * browser) is what lets the full sign-in → callback flow complete inside the
 * desktop window instead of leaking to the browser. Suffix matches are
 * dot-anchored so `github.com.evil.com` does NOT match.
 */
function isAllowedAuthHost(hostname) {
  const exact = [
    "github.com",
    "linear.app",
    "accounts.google.com",
    "appleid.apple.com",
    "gitlab.com",
    "discord.com",
    "slack.com",
  ];
  if (exact.includes(hostname)) return true;
  const suffixes = [
    // Clerk (hosted account portal + frontend API, dev and prod).
    ".clerk.com",
    ".clerk.accounts.dev",
    ".accounts.dev",
    // OAuth / identity providers Clerk can federate to.
    ".github.com",
    ".linear.app",
    ".google.com",
    ".microsoftonline.com",
    ".live.com",
    ".apple.com",
    ".gitlab.com",
    ".facebook.com",
    ".discord.com",
    ".slack.com",
    ".okta.com",
    ".auth0.com",
  ];
  return suffixes.some((s) => hostname.endsWith(s));
}

/** Only hand these schemes to the OS — never file:, smb:, or custom handlers. */
function isSafeExternalScheme(url) {
  return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
}

/** Opens a URL in the system browser if (and only if) its scheme is safe. */
function openExternalSafely(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return;
  }
  if (isSafeExternalScheme(parsed)) void shell.openExternal(rawUrl);
}

/**
 * Installs the navigation/window-open policy on a single webContents.
 * Applied to every webContents (main + popups) via app `web-contents-created`.
 *
 * @param {Electron.WebContents} contents
 * @param {string} appOrigin  The trusted embedded-app origin.
 */
function installNavigationGuards(contents, appOrigin) {
  // Keep app-origin and auth/identity navigation IN the window (so the Clerk
  // sign-in → OAuth → callback chain completes inside the app and returns here);
  // bounce only genuine external links out to the system browser.
  contents.on("will-navigate", (event, url) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      return;
    }
    if (target.origin === appOrigin || isAllowedAuthHost(target.hostname)) {
      return;
    }
    event.preventDefault();
    openExternalSafely(url);
  });

  // window.open / target=_blank: allow app origin + known auth popups as child
  // windows; everything else opens in the OS browser.
  contents.setWindowOpenHandler(({ url }) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      return { action: "deny" };
    }

    if (target.origin === appOrigin || isAllowedAuthHost(target.hostname)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
        },
      };
    }

    openExternalSafely(url);
    return { action: "deny" };
  });

  // Never allow embedding arbitrary <webview> content.
  contents.on("will-attach-webview", (event) => event.preventDefault());
}

/**
 * Creates the main BrowserWindow and points it at the embedded app. Navigation
 * guards are installed app-wide (see installNavigationGuards), so they are not
 * re-bound here.
 *
 * @param {object} opts
 * @param {string} opts.baseUrl  Origin the embedded server is serving.
 * @returns {Electron.BrowserWindow}
 */
function createMainWindow({ baseUrl }) {
  const win = new BrowserWindow({
    icon: path.join(__dirname, "..", "icon.png"),
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0a0a0a",
    show: false,
    title: "Avion",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  // Show only once the first paint is ready to avoid a white flash.
  win.once("ready-to-show", () => win.show());

  void win.loadURL(baseUrl);

  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  return win;
}

module.exports = { createMainWindow, installNavigationGuards };
