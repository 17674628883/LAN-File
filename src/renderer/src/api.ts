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
};

export type LanTransferApi = {
  getStatus(): Promise<AppStatus>;
  chooseSharedFolder(): Promise<string | undefined>;
  removeTrustedDevice(deviceId: string): Promise<void>;
  respondToPairing(requestId: string, accepted: boolean): Promise<void>;
};

declare global {
  interface Window {
    lanTransfer: LanTransferApi;
  }
}

export const api = window.lanTransfer;
