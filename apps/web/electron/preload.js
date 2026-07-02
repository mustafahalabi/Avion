"use strict";

/**
 * Preload script — runs in an isolated context with limited Node access and
 * bridges a tiny, read-only surface to the web app. The Next.js UI is unaware
 * of Electron; this just lets it optionally detect the desktop shell.
 */

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronApp", {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
