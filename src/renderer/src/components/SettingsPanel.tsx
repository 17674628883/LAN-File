import type { ReactElement } from "react";

type SettingsPanelProps = {
  receiveFolder: string;
  onChooseReceiveFolder(): void;
  onOpenReceiveFolder(): void;
};

export function SettingsPanel({
  receiveFolder,
  onChooseReceiveFolder,
  onOpenReceiveFolder
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
    </section>
  );
}
