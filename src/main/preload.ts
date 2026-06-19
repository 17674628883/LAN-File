import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("lanTransfer", {
  getStatus: () => ipcRenderer.invoke("status:get"),
  chooseSharedFolder: () => ipcRenderer.invoke("sharedFolder:choose"),
  sendFileToPeer: (deviceId: string) => ipcRenderer.invoke("transfer:sendFileToPeer", deviceId),
  sendFolderToPeer: (deviceId: string) => ipcRenderer.invoke("transfer:sendFolderToPeer", deviceId),
  cancelTransfer: (transferId: string) => ipcRenderer.invoke("transfer:cancel", transferId),
  retryTransfer: (transferId: string) => ipcRenderer.invoke("transfer:retry", transferId),
  removeTrustedDevice: (deviceId: string) => ipcRenderer.invoke("trustedDevices:remove", deviceId),
  respondToPairing: (requestId: string, accepted: boolean) => ipcRenderer.invoke("pairing:respond", requestId, accepted)
});
