"use strict";

const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");

let backend;
let mainWindow;
let updateState = { status: "idle", version: null, percent: 0, message: "" };

function setUpdateState(changes) {
  updateState = { ...updateState, ...changes };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updater:state", updateState);
  }
}

function checkForUpdates() {
  if (!app.isPackaged) {
    setUpdateState({ status: "none", message: "Updates are only available in the installed app." });
    return Promise.resolve();
  }
  if (["checking", "downloading", "ready"].includes(updateState.status)) return Promise.resolve();
  setUpdateState({ status: "checking", message: "" });
  return autoUpdater.checkForUpdates().catch(() => undefined);
}

function setupUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", (info) => {
    setUpdateState({ status: "available", version: info.version, percent: 0, message: "" });
  });
  autoUpdater.on("update-not-available", () => {
    setUpdateState({ status: "none", message: "You have the latest version." });
  });
  autoUpdater.on("download-progress", (progress) => {
    setUpdateState({ status: "downloading", percent: Math.round(progress.percent) });
  });
  autoUpdater.on("update-downloaded", () => {
    setUpdateState({ status: "ready", percent: 100 });
    setImmediate(() => autoUpdater.quitAndInstall());
  });
  autoUpdater.on("error", (error) => {
    console.error("App update error:", error);
    setUpdateState({ status: "error", message: "Couldn't check for updates. Please try again later." });
  });

  ipcMain.handle("updater:get-state", () => updateState);
  ipcMain.handle("updater:check", () => checkForUpdates());
  ipcMain.handle("updater:install", () => {
    if (updateState.status !== "available") return;
    setUpdateState({ status: "downloading", percent: 0 });
    return autoUpdater.downloadUpdate().catch(() => undefined);
  });
}

async function launch() {
  await app.whenReady();
  app.setAppUserModelId("com.finance.dashboard");

  process.env.NODE_ENV = "production";
  process.env.FINANCE_DATA_DIR = path.join(app.getPath("userData"), "data");
  process.env.PORT = "0";
  setupUpdater();

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
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${origin}/`)) event.preventDefault();
  });
  await mainWindow.loadURL(origin);

  if (app.isPackaged) void checkForUpdates();
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