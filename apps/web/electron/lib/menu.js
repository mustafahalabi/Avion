"use strict";

/**
 * Native application menu.
 *
 * Beyond the standard edit/window/view roles, it exposes the desktop-specific
 * controls: opening the per-user data folder and toggling the autonomous
 * worker/driver automation.
 */

const { Menu, shell, app, dialog } = require("electron");

/**
 * Installs the application menu.
 *
 * @param {object} handlers
 * @param {() => boolean} handlers.isAutomationRunning
 * @param {() => void} handlers.onToggleAutomation
 * @param {() => string} handlers.getUserDataDir
 * @param {() => string} handlers.getDbPath
 */
function buildMenu(handlers) {
  const isMac = process.platform === "darwin";

  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Automation",
      submenu: [
        {
          label: handlers.isAutomationRunning()
            ? "Stop worker + driver"
            : "Start worker + driver",
          click: () => handlers.onToggleAutomation(),
        },
        { type: "separator" },
        {
          label: "Open data folder",
          click: () => void shell.openPath(handlers.getUserDataDir()),
        },
        {
          label: "Show database path…",
          click: () =>
            dialog.showMessageBox({
              type: "info",
              title: "Database",
              message: "Avion database",
              detail: handlers.getDbPath(),
            }),
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [{ type: "separator" }, { role: "front" }]
          : [{ role: "close" }]),
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Avion on GitHub",
          click: () =>
            void shell.openExternal("https://github.com/mustafahalabi/engineering-os"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
