import type { ReactElement } from "react";
import { createUpdateStatusMessage, type UpdateState } from "../../../shared/updateTypes";

type SettingsPanelProps = {
  receiveFolder: string;
  updateState: UpdateState;
  onChooseReceiveFolder(): void;
  onOpenReceiveFolder(): void;
  onCheckForUpdates(): void;
  onInstallDownloadedUpdate(): void;
};

export function SettingsPanel({
  receiveFolder,
  updateState,
  onChooseReceiveFolder,
  onOpenReceiveFolder,
  onCheckForUpdates,
  onInstallDownloadedUpdate
}: SettingsPanelProps): ReactElement {
  return (
    <section className="panel" aria-labelledby="settings-title">
      <header className="panelHeader">
        <h2 id="settings-title">设置</h2>
      </header>

      <section className="folderPanel" aria-labelledby="receive-folder-title">
        <div>
          <span className="fieldLabel" id="receive-folder-title">
            接收文件夹
          </span>
          <p className="folderPath">{receiveFolder || "正在读取..."}</p>
        </div>
        <div className="headerActions">
          <button className="secondaryButton" type="button" onClick={onOpenReceiveFolder}>
            打开文件夹
          </button>
          <button className="primaryButton" type="button" onClick={onChooseReceiveFolder}>
            更改位置
          </button>
        </div>
      </section>

      <section className="folderPanel" aria-labelledby="update-title">
        <div>
          <span className="fieldLabel" id="update-title">
            软件更新
          </span>
          <p className="folderPath">{createUpdateStatusMessage(updateState)}</p>
        </div>
        <div className="headerActions">
          <button className="secondaryButton" type="button" onClick={onCheckForUpdates} disabled={updateState.status === "checking"}>
            检查更新
          </button>
          <button
            className="primaryButton"
            type="button"
            onClick={onInstallDownloadedUpdate}
            disabled={updateState.status !== "downloaded"}
          >
            重启安装
          </button>
        </div>
      </section>
    </section>
  );
}
