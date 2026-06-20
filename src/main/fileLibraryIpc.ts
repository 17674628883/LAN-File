import { ipcMain, shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { FileBrowserEntry, FileBrowserLocation } from "../shared/fileBrowserTypes";
import { listLocalDirectory } from "./core/fileLibrary";
import { resolveSharedRealPath } from "./core/pathSafety";

export function registerFileLibraryIpc(options: {
  getSharedRoot(): string | undefined;
  getReceivedRoot(): string;
  listPeer(deviceId: string, relativePath: string): Promise<FileBrowserEntry[]>;
  downloadPeer(deviceId: string, relativePath: string): Promise<string>;
}): void {
  ipcMain.handle("fileLibrary:list", async (_event, location: FileBrowserLocation) => {
    if (location.source === "shared-local") {
      const root = options.getSharedRoot();
      if (!root) return [];
      return listLocalDirectory(root, location.relativePath);
    }

    if (location.source === "received-local") {
      await fs.mkdir(options.getReceivedRoot(), { recursive: true });
      return listLocalDirectory(options.getReceivedRoot(), location.relativePath);
    }

    if (!location.peerDeviceId) {
      throw new Error("Peer device id is required.");
    }

    return options.listPeer(location.peerDeviceId, location.relativePath);
  });

  ipcMain.handle("fileLibrary:open", async (_event, relativePath: string) => {
    const filePath = await resolveReceivedFile(options.getReceivedRoot(), relativePath);
    const errorMessage = await shell.openPath(filePath);

    if (errorMessage) {
      throw new Error(errorMessage);
    }
  });

  ipcMain.handle("fileLibrary:show", async (_event, relativePath: string) => {
    const filePath = await resolveReceivedFile(options.getReceivedRoot(), relativePath);
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle("fileLibrary:deleteReceived", async (_event, relativePath: string) => {
    const filePath = await resolveReceivedFile(options.getReceivedRoot(), relativePath);
    await fs.rm(filePath, { force: true });
  });

  ipcMain.handle("fileLibrary:downloadPeer", async (_event, deviceId: string, relativePath: string) => {
    return options.downloadPeer(deviceId, relativePath);
  });
}

async function resolveReceivedFile(root: string, relativePath: string): Promise<string> {
  const result = await resolveSharedRealPath(root, relativePath);

  if (!result.ok) {
    throw new Error(`Invalid received file path: ${result.reason}`);
  }

  const stats = await fs.stat(result.path);

  if (!stats.isFile()) {
    throw new Error("Invalid received file path: Requested path is not a file.");
  }

  return result.path;
}
