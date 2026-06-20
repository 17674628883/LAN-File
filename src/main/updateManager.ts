import type { BrowserWindow } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateCheckResult, type UpdateInfo } from "electron-updater";
import type { UpdateState } from "../shared/updateTypes";

export type UpdateManager = {
  checkForUpdates(): Promise<UpdateState>;
  installDownloadedUpdate(): void;
  getState(): UpdateState;
};

export function createUpdateManager(options: { getMainWindow(): BrowserWindow | undefined; isEnabled(): boolean }): UpdateManager {
  let state: UpdateState = { status: "idle" };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const publishState = (nextState: UpdateState): void => {
    state = nextState;
    options.getMainWindow()?.webContents.send("update:state", state);
  };

  autoUpdater.on("checking-for-update", () => publishState({ status: "checking" }));
  autoUpdater.on("update-available", (info: UpdateInfo) => publishState({ status: "available", version: info.version }));
  autoUpdater.on("update-not-available", () => publishState({ status: "not-available" }));
  autoUpdater.on("download-progress", (progress: ProgressInfo) =>
    publishState({ status: "downloading", percent: progress.percent })
  );
  autoUpdater.on("update-downloaded", (info: UpdateInfo) => publishState({ status: "downloaded", version: info.version }));
  autoUpdater.on("error", (error: Error) => publishState({ status: "error", message: error.message }));

  return {
    async checkForUpdates(): Promise<UpdateState> {
      if (!options.isEnabled()) {
        publishState({ status: "error", message: "开发模式下不能检查自动更新。" });
        return state;
      }

      publishState({ status: "checking" });
      try {
        const result: UpdateCheckResult | null = await autoUpdater.checkForUpdates();
        if (state.status === "checking" && !result) {
          publishState({ status: "not-available" });
        }
        return state;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "无法检查更新。";
        publishState({ status: "error", message });
        return state;
      }
    },
    installDownloadedUpdate(): void {
      autoUpdater.quitAndInstall(false, true);
    },
    getState(): UpdateState {
      return state;
    }
  };
}
