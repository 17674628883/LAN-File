import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from "electron";
import Store from "electron-store";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { createChineseMenuTemplate } from "./core/appMenu";
import { createDiscoveryService, type DiscoveryService, type PeerInfo } from "./core/discovery";
import { loadOrCreateDeviceIdentity, type DeviceIdentity } from "./core/deviceIdentity";
import { getLanAddress } from "./core/lanAddress";
import { startLanServer, type LanServer } from "./core/lanServer";
import { requestPeerPairing } from "./core/pairingClient";
import { createPeerSharedClient } from "./core/peerSharedClient";
import { createTransferStore } from "./core/transferStore";
import type { TransferTask } from "./core/transferTypes";
import { createTrustedDeviceStore, type TrustedDeviceRecord } from "./core/trustedDevices";
import { registerFileLibraryIpc } from "./fileLibraryIpc";
import { showReceiveNotification } from "./notifications";

const store = new Store<{ identity?: DeviceIdentity; trustedDevices?: TrustedDeviceRecord[]; sharedFolder?: string }>();
const transferStore = createTransferStore();
const trustedDevices = createTrustedDeviceStore({
  get: () => store.get("trustedDevices") ?? [],
  set: (value) => store.set("trustedDevices", value)
});
let discoveryService: DiscoveryService | undefined;
let lanServer: LanServer | undefined;
let currentIdentity: DeviceIdentity | undefined;
let sharedFolder = store.get("sharedFolder");
const peers = new Map<string, PeerInfo>();
const activeTransferControllers = new Map<string, AbortController>();
const peerAccessTokens = new Map<string, string>();
const peerSharedClient = createPeerSharedClient({ getAccessToken: getPeerAccessToken });
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

function installChineseApplicationMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(createChineseMenuTemplate()));
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
    getReceiveFolder: getReceiveFolderPath,
    isTrusted: (deviceId) => trustedDevices.isTrusted(deviceId),
    onUploadCompleted: showReceiveNotification,
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
  registerFileLibraryIpc({
    getSharedRoot: () => sharedFolder,
    getReceivedRoot: getReceiveFolderPath,
    listPeer: (deviceId, relativePath) => peerSharedClient.list(getTrustedPeer(deviceId), relativePath),
    downloadPeer: (deviceId, relativePath) => peerSharedClient.download(getTrustedPeer(deviceId), relativePath, getReceiveFolderPath())
  });

  ipcMain.handle("status:get", () => getStatus());

  ipcMain.handle("pairing:request", async (_event, deviceId: string) => {
    const peer = peers.get(deviceId);
    const identity = currentIdentity;

    if (!peer) {
      throw new Error("Peer is offline.");
    }

    if (!identity) {
      throw new Error("This device is not ready for pairing.");
    }

    const result = await requestPeerPairing(peer, identity);
    if (!result.paired) {
      return false;
    }

    if (result.accessToken) {
      peerAccessTokens.set(peer.deviceId, result.accessToken);
    }

    const now = Date.now();
    trustedDevices.trust({
      deviceId: peer.deviceId,
      displayName: peer.name,
      deviceType: "desktop",
      trustedAt: now,
      lastSeenAt: now
    });
    return true;
  });

  ipcMain.handle("sharedFolder:browsePeer", async (_event, deviceId: string) => {
    const peer = getTrustedPeer(deviceId);
    const identity = currentIdentity;

    if (!identity) {
      throw new Error("This device is not ready.");
    }

    const result = await requestPeerPairing(peer, identity);
    if (!result.paired || !result.accessToken) {
      throw new Error("Unable to access the peer shared folder.");
    }

    peerAccessTokens.set(peer.deviceId, result.accessToken);
  });

  ipcMain.handle("sharedFolder:choose", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return undefined;
    }

    sharedFolder = result.filePaths[0];
    store.set("sharedFolder", sharedFolder);
    return sharedFolder;
  });

  ipcMain.handle("receiveFolder:open", async () => {
    const receiveFolder = getReceiveFolderPath();
    await fs.promises.mkdir(receiveFolder, { recursive: true });
    const errorMessage = await shell.openPath(receiveFolder);

    if (errorMessage) {
      throw new Error(errorMessage);
    }
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
  ipcMain.handle("transfer:sendPathsToPeer", async (_event, deviceId: string, paths: string[]) => {
    if (!Array.isArray(paths) || paths.length === 0) {
      throw new Error("No files were dropped.");
    }

    const peer = getTrustedPeer(deviceId);

    for (const droppedPath of paths) {
      await sendPathToPeer(peer, droppedPath);
    }
  });
  ipcMain.handle("transfer:cancel", (_event, transferId: string) => {
    activeTransferControllers.get(transferId)?.abort();
    transferStore.cancel(transferId);
  });
  ipcMain.handle("transfer:retry", () => undefined);
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

async function getPeerAccessToken(peer: PeerInfo): Promise<string> {
  const existingToken = peerAccessTokens.get(peer.deviceId);

  if (existingToken) {
    return existingToken;
  }

  const identity = currentIdentity;
  if (!identity) {
    throw new Error("This device is not ready.");
  }

  const result = await requestPeerPairing(peer, identity);
  if (!result.paired || !result.accessToken) {
    throw new Error("Unable to access the peer shared folder.");
  }

  peerAccessTokens.set(peer.deviceId, result.accessToken);
  return result.accessToken;
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

async function sendPathToPeer(peer: PeerInfo, droppedPath: string): Promise<void> {
  const stats = await fs.promises.stat(droppedPath);

  if (stats.isFile()) {
    await uploadFileToPeer(peer, droppedPath);
    return;
  }

  if (stats.isDirectory()) {
    const files = await collectFiles(droppedPath);
    const folderName = path.basename(droppedPath);

    for (const file of files) {
      await uploadFileToPeer(peer, file.absolutePath, path.posix.join(folderName, file.relativePath));
    }
    return;
  }

  throw new Error(`${path.basename(droppedPath)} is not a file or folder.`);
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
  const progressStream = createProgressStream(transfer.id);
  const uploadStream = fileStream.pipe(progressStream);
  const abortController = new AbortController();
  const requestInit: StreamingRequestInit = {
    method: "POST",
    body: Readable.toWeb(uploadStream) as BodyInit,
    duplex: "half",
    signal: abortController.signal,
    headers: {
      "content-length": String(stats.size),
      "content-type": "application/octet-stream",
      "x-device-id": currentIdentity?.deviceId ?? "",
      "x-file-name": encodeURIComponent(displayName)
    }
  };

  try {
    activeTransferControllers.set(transfer.id, abortController);
    const response = await fetch(createPeerUploadUrl(peer), requestInit as RequestInit);

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(
        `Failed to upload ${displayName}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ""}`
      );
    }

    transferStore.complete(transfer.id);
  } catch (error: unknown) {
    if (abortController.signal.aborted) {
      transferStore.cancel(transfer.id);
    } else {
      transferStore.fail(transfer.id, error instanceof Error ? error.message : "Upload failed.");
    }

    if (!fileStream.destroyed) {
      fileStream.destroy(error instanceof Error ? error : undefined);
    }
    if (!progressStream.destroyed) {
      progressStream.destroy(error instanceof Error ? error : undefined);
    }
    throw error;
  } finally {
    activeTransferControllers.delete(transfer.id);
    if (!fileStream.destroyed) {
      fileStream.destroy();
    }
    if (!progressStream.destroyed) {
      progressStream.destroy();
    }
  }
}

function createProgressStream(transferId: string): Transform {
  let transferredBytes = 0;

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      transferredBytes += chunk.length;
      transferStore.progress(transferId, transferredBytes);
      callback(null, chunk);
    }
  });
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

function getReceiveFolderPath(): string {
  return path.join(app.getPath("downloads"), "LAN File Transfer");
}

app.whenReady().then(async () => {
  installChineseApplicationMenu();
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
