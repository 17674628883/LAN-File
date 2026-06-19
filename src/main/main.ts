import { app, BrowserWindow } from "electron";
import Store from "electron-store";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDiscoveryService, type DiscoveryService } from "./core/discovery";
import { loadOrCreateDeviceIdentity, type DeviceIdentity } from "./core/deviceIdentity";
import { getLanAddress } from "./core/lanAddress";
import { startLanServer, type LanServer } from "./core/lanServer";

const store = new Store<{ identity?: DeviceIdentity }>();
let discoveryService: DiscoveryService | undefined;
let lanServer: LanServer | undefined;
let isShuttingDown = false;

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
  const host = getLanAddress();

  lanServer = await startLanServer({
    identity,
    host,
    preferredPort: 43670
  });

  discoveryService = createDiscoveryService({
    serviceName: identity.displayName,
    port: lanServer.port,
    deviceId: identity.deviceId
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

  const server = lanServer;
  lanServer = undefined;
  await server?.close();
}

app.whenReady().then(async () => {
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
