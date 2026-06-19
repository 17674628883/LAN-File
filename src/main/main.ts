import { app, BrowserWindow, dialog, ipcMain } from "electron";
import Store from "electron-store";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDiscoveryService, type DiscoveryService, type PeerInfo } from "./core/discovery";
import { loadOrCreateDeviceIdentity, type DeviceIdentity } from "./core/deviceIdentity";
import { getLanAddress } from "./core/lanAddress";
import { startLanServer, type LanServer } from "./core/lanServer";
import { createTrustedDeviceStore, type TrustedDeviceRecord } from "./core/trustedDevices";

const store = new Store<{ identity?: DeviceIdentity; trustedDevices?: TrustedDeviceRecord[] }>();
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
  transfers: [];
  sharedFolder?: string;
};

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
  ipcMain.handle("pairing:respond", () => undefined);
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
    transfers: [],
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
