import { useState, type ReactElement } from "react";
import type { FileBrowserEntry, FileBrowserView } from "../../../shared/fileBrowserTypes";
import { FileBrowser } from "./FileBrowser";

type SharedFilesPanelProps = {
  rootPath?: string;
  enabled: boolean;
  entries: FileBrowserEntry[];
  loading: boolean;
  relativePath: string;
  onEnabledChange(enabled: boolean): void;
  onChooseRoot(): void;
  onOpenRoot(): void;
  onRefresh(): void;
  onOpenDirectory(relativePath: string): void;
};

export function SharedFilesPanel({
  rootPath,
  enabled,
  entries,
  loading,
  relativePath,
  onEnabledChange,
  onChooseRoot,
  onOpenRoot,
  onRefresh,
  onOpenDirectory
}: SharedFilesPanelProps): ReactElement {
  const [view, setView] = useState<FileBrowserView>("list");

  return (
    <section className="panel" aria-labelledby="shared-files-title">
      <header className="panelHeader">
        <h2 id="shared-files-title">共享文件</h2>
      </header>

      <section className="folderPanel" aria-labelledby="shared-folder-title">
        <div>
          <label className="toggleLabel" htmlFor="shared-folder-enabled">
            <input
              id="shared-folder-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(event) => onEnabledChange(event.currentTarget.checked)}
            />
            <span>允许已配对设备浏览我的共享文件夹</span>
          </label>
          <span className="fieldLabel" id="shared-folder-title">
            当前文件夹
          </span>
          <p className="folderPath">{rootPath ?? "尚未选择共享文件夹。"}</p>
        </div>
        <div className="headerActions">
          <button className="secondaryButton" type="button" onClick={onChooseRoot}>
            更换文件夹
          </button>
          <button className="primaryButton" type="button" onClick={onOpenRoot} disabled={!rootPath}>
            打开文件夹
          </button>
        </div>
      </section>

      <p className="fieldLabel">关闭后，对方不能浏览或下载这里的文件；不影响你接收文件。</p>
      <FileBrowser
        entries={entries}
        loading={loading}
        location={{ source: "shared-local", relativePath }}
        view={view}
        onChangeView={setView}
        onOpenDirectory={onOpenDirectory}
        onOpenFile={() => undefined}
        onRefresh={onRefresh}
        onNavigate={onOpenDirectory}
      />
    </section>
  );
}
