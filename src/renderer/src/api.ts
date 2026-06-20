import type { FileBrowserEntry, FileBrowserLocation } from "../../shared/fileBrowserTypes";
import type { UpdateState } from "../../shared/updateTypes";

export type Peer = {
  name: string;
  host: string;
  port: number;
  deviceId: string;
  paired: boolean;
};

export type Transfer = {
  id: string;
  name: string;
  direction: "send" | "receive";
  totalBytes: number;
  transferredBytes: number;
  status: "active" | "completed" | "failed" | "canceled";
  startedAt: number;
  updatedAt: number;
  error?: string;
};

export type AppStatus = {
  deviceName: string;
  lanUrl: string;
  mobileUrl: string;
  peers: Peer[];
  transfers: Transfer[];
  sharedFolder?: string;
  sharedFolderEnabled: boolean;
  receiveFolder: string;
};

export type LanTransferApi = {
  getStatus(): Promise<AppStatus>;
  rescanPeers(): Promise<AppStatus>;
  requestPairing(deviceId: string): Promise<boolean>;
  chooseSharedFolder(): Promise<string | undefined>;
  setSharedFolderEnabled(enabled: boolean): Promise<boolean>;
  openSharedFolder(): Promise<void>;
  chooseReceiveFolder(): Promise<string | undefined>;
  openReceiveFolder(): Promise<void>;
  listFiles(location: FileBrowserLocation): Promise<FileBrowserEntry[]>;
  openLocalFile(relativePath: string): Promise<void>;
  showLocalFile(relativePath: string): Promise<void>;
  deleteReceivedFile(relativePath: string): Promise<void>;
  downloadPeerFile(deviceId: string, relativePath: string): Promise<string>;
  getPathForDroppedFile(file: File): string;
  browsePeerSharedFolder(deviceId: string): Promise<void>;
  sendFileToPeer(deviceId: string): Promise<void>;
  sendFolderToPeer(deviceId: string): Promise<void>;
  sendPathsToPeer(deviceId: string, paths: string[]): Promise<void>;
  cancelTransfer(transferId: string): Promise<void>;
  retryTransfer(transferId: string): Promise<void>;
  removeTrustedDevice(deviceId: string): Promise<void>;
  respondToPairing(requestId: string, accepted: boolean): Promise<void>;
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<UpdateState>;
  installDownloadedUpdate(): Promise<void>;
  onUpdateStateChanged(callback: (state: UpdateState) => void): () => void;
};

declare global {
  interface Window {
    lanTransfer: LanTransferApi;
  }
}

export const api = window.lanTransfer;
