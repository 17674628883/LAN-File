import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("lanTransfer", {
  getStatus: () => ipcRenderer.invoke("status:get"),
  chooseSharedFolder: () => ipcRenderer.invoke("sharedFolder:choose"),
  sendFileToPeer: (deviceId: string) => ipcRenderer.invoke("transfer:sendFileToPeer", deviceId),
  removeTrustedDevice: (deviceId: string) => ipcRenderer.invoke("trustedDevices:remove", deviceId),
  respondToPairing: (requestId: string, accepted: boolean) => ipcRenderer.invoke("pairing:respond", requestId, accepted)
});
