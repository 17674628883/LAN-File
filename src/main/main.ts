import { app, BrowserWindow, dialog, ipcMain } from "electron";
import Store from "electron-store";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { createDiscoveryService, type DiscoveryService, type PeerInfo } from "./core/discovery";
import { loadOrCreateDeviceIdentity, type DeviceIdentity } from "./core/deviceIdentity";
import { getLanAddress } from "./core/lanAddress";
import { startLanServer, type LanServer } from "./core/lanServer";
import { createTransferStore } from "./core/transferStore";
import type { TransferTask } from "./core/transferTypes";
import { createTrustedDeviceStore, type TrustedDeviceRecord } from "./core/trustedDevices";

const store = new Store<{ identity?: DeviceIdentity; trustedDevices?: TrustedDeviceRecord[] }>();
const transferStore = createTransferStore();
const trustedDevices = createTrustedDeviceStore({
  get: () => store.get("trustedDevices") ?? [],
  set: (value) => store.set("trustedDevices", value)
});
let discoveryService: DiscoveryService | undefined;
let lanServer: LanServer | undefined;
let currentIdentity: DeviceIdentity | undefined;
let sharedFolder: string | undefined;
const peers = new Map<string, PeerInfo>();
let isShuttingDown = false;

type AppStatus = {
  deviceName: string;
  lanUrl: string;
  mobileUrl: string;
  peers: Array<PeerInfo & { paired: boolean }>;
  transfers: TransferTask[];
  sharedFolder?: string;
};

type StreamingRequestInit = RequestInit & { duplex: "half" };
type CollectedFile = { absolutePath: string; relativePath: string };

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

async function startLanServices(): Promise<void> {
  const identity = loadOrCreateDeviceIdentity(
    {
      get: () => store.get("identity"),
      set: (value) => store.set("identity", value as DeviceIdentity)
    },
    os.hostname()
  );
  currentIdentity = identity;
  const host = getLanAddress();

  lanServer = await startLanServer({
    identity,
    host,
    preferredPort: 43670,
    getSharedFolder: () => sharedFolder,
    getReceiveFolder: () => path.join(app.getPath("downloads"), "LAN File Transfer"),
    isTrusted: (deviceId) => trustedDevices.isTrusted(deviceId),
    requestPairing: async (remote) => {
      const accepted =
        dialog.showMessageBoxSync({
          type: "question",
          buttons: ["\u5141\u8bb8", "\u62d2\u7edd"],
          defaultId: 0,
          cancelId: 1,
          title: "\u8bbe\u5907\u914d\u5bf9\u8bf7\u6c42",
          message: `${remote.displayName} \u60f3\u8fde\u63a5\u8fd9\u53f0\u7535\u8111\u3002`
        }) === 0;

      if (accepted) {
        const now = Date.now();
        trustedDevices.trust({ ...remote, trustedAt: now, lastSeenAt: now });
      }

      return accepted;
    }
  });

  discoveryService = createDiscoveryService({
    serviceName: identity.displayName,
    port: lanServer.port,
    deviceId: identity.deviceId
  });
  discoveryService.onPeer((peer) => {
    peers.set(peer.deviceId, peer);
  });
  discoveryService.start();
}

function resolvePreloadPath(): string {
  const preloadPaths = [path.join(__dirname, "../preload/preload.js"), path.join(__dirname, "../preload/preload.mjs")];
  return preloadPaths.find((preloadPath) => fs.existsSync(preloadPath)) ?? preloadPaths[0];
}

async function shutdownLanServices(): Promise<void> {
  discoveryService?.stop();
  discoveryService = undefined;
  peers.clear();

  const server = lanServer;
  lanServer = undefined;
  await server?.close();
}

function registerIpcHandlers(): void {
  ipcMain.handle("status:get", () => getStatus());

  ipcMain.handle("sharedFolder:choose", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return undefined;
    }

    sharedFolder = result.filePaths[0];
    return sharedFolder;
  });

  ipcMain.handle("trustedDevices:remove", (_event, deviceId: string) => {
    trustedDevices.remove(deviceId);
  });
  ipcMain.handle("transfer:sendFileToPeer", async (_event, deviceId: string) => {
    const peer = getTrustedPeer(deviceId);

    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return;
    }

    for (const filePath of result.filePaths) {
      await uploadFileToPeer(peer, filePath);
    }
  });
  ipcMain.handle("transfer:sendFolderToPeer", async (_event, deviceId: string) => {
    const peer = getTrustedPeer(deviceId);

    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return;
    }

    const files = await collectFiles(result.filePaths[0]);

    for (const file of files) {
      await uploadFileToPeer(peer, file.absolutePath, file.relativePath);
    }
  });
  ipcMain.handle("transfer:cancel", (_event, transferId: string) => {
    transferStore.cancel(transferId);
  });
  ipcMain.handle("transfer:retry", (_event, transferId: string) => {
    const failedTransfer = transferStore.list().find((transfer) => transfer.id === transferId && transfer.status === "failed");

    if (!failedTransfer) {
      return;
    }

    transferStore.start({
      id: `${failedTransfer.id}-retry-${Date.now()}`,
      name: failedTransfer.name,
      direction: failedTransfer.direction,
      totalBytes: failedTransfer.totalBytes
    });
  });
  ipcMain.handle("pairing:respond", () => undefined);
}

function getTrustedPeer(deviceId: string): PeerInfo {
  const peer = peers.get(deviceId);

  if (!peer) {
    throw new Error("Peer is offline.");
  }

  if (!trustedDevices.isTrusted(deviceId)) {
    throw new Error("Pair with this device before sending files.");
  }

  return peer;
}

async function collectFiles(root: string): Promise<CollectedFile[]> {
  const rootStats = await fs.promises.stat(root);

  if (!rootStats.isDirectory()) {
    throw new Error(`${path.basename(root)} is not a folder.`);
  }

  const files: CollectedFile[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        files.push({
          absolutePath,
          relativePath: path.relative(root, absolutePath).split(path.sep).join("/")
        });
      }
    }
  }

  await visit(root);
  return files;
}

async function uploadFileToPeer(peer: PeerInfo, filePath: string, relativePath?: string): Promise<void> {
  const stats = await fs.promises.stat(filePath);

  if (!stats.isFile()) {
    throw new Error(`${path.basename(filePath)} is not a file.`);
  }

  const displayName = relativePath ?? path.basename(filePath);
  const transfer = transferStore.start({
    id: randomUUID(),
    name: displayName,
    direction: "send",
    totalBytes: stats.size
  });
  const fileStream = fs.createReadStream(filePath);
  const requestInit: StreamingRequestInit = {
    method: "POST",
    body: Readable.toWeb(fileStream) as BodyInit,
    duplex: "half",
    headers: {
      "content-length": String(stats.size),
      "content-type": "application/octet-stream",
      "x-device-id": currentIdentity?.deviceId ?? "",
      "x-file-name": encodeURIComponent(displayName)
    }
  };

  try {
    const response = await fetch(createPeerUploadUrl(peer), requestInit as RequestInit);

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(
        `Failed to upload ${displayName}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ""}`
      );
    }

    transferStore.complete(transfer.id);
  } catch (error: unknown) {
    transferStore.fail(transfer.id, error instanceof Error ? error.message : "Upload failed.");

    if (!fileStream.destroyed) {
      fileStream.destroy(error instanceof Error ? error : undefined);
    }
    throw error;
  } finally {
    if (!fileStream.destroyed) {
      fileStream.destroy();
    }
  }
}

function createPeerUploadUrl(peer: PeerInfo): string {
  return new URL("/api/upload", `http://${formatHostForUrl(peer.host)}:${peer.port}`).toString();
}

function formatHostForUrl(host: string): string {
  if (host.includes(":") && !host.startsWith("[") && !host.endsWith("]")) {
    return `[${host}]`;
  }

  return host;
}

function getStatus(): AppStatus {
  const lanUrl = lanServer?.url ?? "";

  return {
    deviceName: currentIdentity?.displayName ?? os.hostname(),
    lanUrl,
    mobileUrl: lanUrl ? `${lanUrl}/mobile` : "",
    peers: Array.from(peers.values()).map((peer) => ({
      ...peer,
      paired: trustedDevices.isTrusted(peer.deviceId)
    })),
    transfers: transferStore.list(),
    sharedFolder
  };
}

app.whenReady().then(async () => {
  registerIpcHandlers();

  try {
    await startLanServices();
  } catch (error: unknown) {
    console.error("Failed to start LAN services", error);
  }

  await createWindow();
});

app.on("before-quit", (event) => {
  if (isShuttingDown) {
    return;
  }

  event.preventDefault();
  isShuttingDown = true;
  shutdownLanServices()
    .catch((error: unknown) => {
      console.error("Failed to stop LAN services", error);
    })
    .finally(() => {
      app.quit();
    });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
