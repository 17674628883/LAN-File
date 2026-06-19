import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("lanTransfer", {
  version: "0.1.0"
});
