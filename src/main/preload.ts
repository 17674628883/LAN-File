import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("lanTransfer", {
  getStatus: () => ipcRenderer.invoke("status:get"),
  chooseSharedFolder: () => ipcRenderer.invoke("sharedFolder:choose"),
  removeTrustedDevice: (deviceId: string) => ipcRenderer.invoke("trustedDevices:remove", deviceId),
  respondToPairing: (requestId: string, accepted: boolean) => ipcRenderer.invoke("pairing:respond", requestId, accepted)
});
