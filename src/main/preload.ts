import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { FileBrowserLocation } from "../shared/fileBrowserTypes";
import type { UpdateState } from "../shared/updateTypes";

contextBridge.exposeInMainWorld("lanTransfer", {
  getStatus: () => ipcRenderer.invoke("status:get"),
  rescanPeers: () => ipcRenderer.invoke("peer:rescan"),
  requestPairing: (deviceId: string) => ipcRenderer.invoke("pairing:request", deviceId),
  chooseSharedFolder: () => ipcRenderer.invoke("sharedFolder:choose"),
  setSharedFolderEnabled: (enabled: boolean) => ipcRenderer.invoke("sharedFolder:setEnabled", enabled),
  openSharedFolder: () => ipcRenderer.invoke("sharedFolder:open"),
  chooseReceiveFolder: () => ipcRenderer.invoke("receiveFolder:choose"),
  openReceiveFolder: () => ipcRenderer.invoke("receiveFolder:open"),
  listFiles: (location: FileBrowserLocation) => ipcRenderer.invoke("fileLibrary:list", location),
  openLocalFile: (relativePath: string) => ipcRenderer.invoke("fileLibrary:open", relativePath),
  showLocalFile: (relativePath: string) => ipcRenderer.invoke("fileLibrary:show", relativePath),
  deleteReceivedFile: (relativePath: string) => ipcRenderer.invoke("fileLibrary:deleteReceived", relativePath),
  downloadPeerFile: (deviceId: string, relativePath: string) => ipcRenderer.invoke("fileLibrary:downloadPeer", deviceId, relativePath),
  getPathForDroppedFile: (file: File) => webUtils.getPathForFile(file),
  browsePeerSharedFolder: (deviceId: string) => ipcRenderer.invoke("sharedFolder:browsePeer", deviceId),
  sendFileToPeer: (deviceId: string) => ipcRenderer.invoke("transfer:sendFileToPeer", deviceId),
  sendFolderToPeer: (deviceId: string) => ipcRenderer.invoke("transfer:sendFolderToPeer", deviceId),
  sendPathsToPeer: (deviceId: string, paths: string[]) => ipcRenderer.invoke("transfer:sendPathsToPeer", deviceId, paths),
  cancelTransfer: (transferId: string) => ipcRenderer.invoke("transfer:cancel", transferId),
  retryTransfer: (transferId: string) => ipcRenderer.invoke("transfer:retry", transferId),
  removeTrustedDevice: (deviceId: string) => ipcRenderer.invoke("trustedDevices:remove", deviceId),
  respondToPairing: (requestId: string, accepted: boolean) => ipcRenderer.invoke("pairing:respond", requestId, accepted),
  getUpdateState: () => ipcRenderer.invoke("update:getState"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  installDownloadedUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateStateChanged: (callback: (state: UpdateState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateState): void => callback(state);
    ipcRenderer.on("update:state", listener);
    return () => ipcRenderer.off("update:state", listener);
  }
});
