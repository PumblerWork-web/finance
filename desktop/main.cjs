"use strict";

const path = require("node:path");
const { app, BrowserWindow, dialog } = require("electron");

let backend;
let mainWindow;

async function launch() {
  await app.whenReady();
  app.setAppUserModelId("com.finance.dashboard");

  process.env.NODE_ENV = "production";
  process.env.FINANCE_DATA_DIR = path.join(app.getPath("userData"), "data");
  process.env.PORT = "0";

  backend = require(path.join(app.getAppPath(), "server", "dist", "index.js"));
  if (!backend.server.listening) {
    await new Promise((resolve, reject) => {
      backend.server.once("listening", resolve);
      backend.server.once("error", reject);
    });
  }

  const address = backend.server.address();
  if (!address || typeof address === "string") {
    throw new Error("The local API did not provide a usable address.");
  }

  const origin = `http://127.0.0.1:${address.port}`;
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#f5f5f2",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${origin}/`)) event.preventDefault();
  });
  await mainWindow.loadURL(origin);
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (!backend) return;
  if (backend.server.listening) backend.server.close();
  backend.db.close();
});

launch().catch((error) => {
  dialog.showErrorBox("Finance Dashboard could not start", error.message);
  app.quit();
});