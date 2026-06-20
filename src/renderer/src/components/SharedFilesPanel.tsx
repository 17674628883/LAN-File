import { useState, type ReactElement } from "react";
import type { FileBrowserEntry, FileBrowserView } from "../../../shared/fileBrowserTypes";
import { FileBrowser } from "./FileBrowser";

type SharedFilesPanelProps = {
  rootPath?: string;
  entries: FileBrowserEntry[];
  loading: boolean;
  onChooseRoot(): void;
  onRefresh(): void;
  onOpenDirectory?(relativePath: string): void;
};

export function SharedFilesPanel({
  rootPath,
  entries,
  loading,
  onChooseRoot,
  onRefresh,
  onOpenDirectory
}: SharedFilesPanelProps): ReactElement {
  const [view, setView] = useState<FileBrowserView>("list");
  const [relativePath, setRelativePath] = useState("");

  const openDirectory = (nextPath: string): void => {
    setRelativePath(nextPath);
    onOpenDirectory?.(nextPath);
  };

  return (
    <section className="panel" aria-labelledby="shared-files-title">
      <header className="panelHeader">
        <div>
          <h2 id="shared-files-title">共享文件</h2>
          <p className="folderPath">{rootPath ?? "尚未选择共享文件夹。"}</p>
        </div>
        <button className="primaryButton" type="button" onClick={onChooseRoot}>
          选择共享文件夹
        </button>
      </header>
      <p className="fieldLabel">远程设备只能浏览和下载，不能修改这里的文件。</p>
      <FileBrowser
        entries={entries}
        loading={loading}
        location={{ source: "shared-local", relativePath }}
        view={view}
        onChangeView={setView}
        onOpenDirectory={openDirectory}
        onOpenFile={() => undefined}
        onRefresh={onRefresh}
        onNavigate={openDirectory}
      />
    </section>
  );
}
