"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("financeUpdater", {
  getState: () => ipcRenderer.invoke("updater:get-state"),
  check: () => ipcRenderer.invoke("updater:check"),
  install: () => ipcRenderer.invoke("updater:install"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("updater:state", listener);
    return () => ipcRenderer.removeListener("updater:state", listener);
  },
});
