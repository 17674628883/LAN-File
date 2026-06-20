import { useState, type ReactElement } from "react";
import type { FileBrowserEntry, FileBrowserView } from "../../../shared/fileBrowserTypes";
import { FileBrowser } from "./FileBrowser";

type ReceivedFilesPanelProps = {
  entries: FileBrowserEntry[];
  loading: boolean;
  onRefresh(): void;
  onOpenFile(relativePath: string): void;
  onShowFile(relativePath: string): void;
  onDeleteFile(relativePath: string): void;
  onOpenReceiveFolder(): void;
  onOpenDirectory?(relativePath: string): void;
};

export function ReceivedFilesPanel({
  entries,
  loading,
  onRefresh,
  onOpenFile,
  onShowFile,
  onDeleteFile,
  onOpenReceiveFolder,
  onOpenDirectory
}: ReceivedFilesPanelProps): ReactElement {
  const [view, setView] = useState<FileBrowserView>("list");
  const [relativePath, setRelativePath] = useState("");
  const [pendingDelete, setPendingDelete] = useState<FileBrowserEntry | undefined>();

  const openDirectory = (nextPath: string): void => {
    setRelativePath(nextPath);
    onOpenDirectory?.(nextPath);
  };

  return (
    <section className="panel" aria-labelledby="received-files-title">
      <header className="panelHeader">
        <h2 id="received-files-title">接收文件</h2>
        <button className="secondaryButton" type="button" onClick={onOpenReceiveFolder}>
          打开接收文件夹
        </button>
      </header>
      <FileBrowser
        entries={entries}
        loading={loading}
        location={{ source: "received-local", relativePath }}
        view={view}
        onChangeView={setView}
        onOpenDirectory={openDirectory}
        onOpenFile={(entry) => onOpenFile(entry.relativePath)}
        onRefresh={onRefresh}
        onNavigate={openDirectory}
      />
      <div className="fileActionsList" aria-label="接收文件操作">
        {entries
          .filter((entry) => entry.kind !== "directory")
          .map((entry) => (
            <div className="fileActionRow" key={entry.relativePath}>
              <span>{entry.name}</span>
              <div className="deviceActions">
                <button className="secondaryButton" type="button" onClick={() => onOpenFile(entry.relativePath)}>
                  打开
                </button>
                <button className="secondaryButton" type="button" onClick={() => onShowFile(entry.relativePath)}>
                  位置
                </button>
                <button className="secondaryButton" type="button" onClick={() => setPendingDelete(entry)}>
                  删除
                </button>
              </div>
            </div>
          ))}
      </div>
      {pendingDelete ? (
        <div className="modalBackdrop" role="presentation">
          <div className="confirmDialog" role="dialog" aria-modal="true" aria-labelledby="delete-received-title">
            <h3 id="delete-received-title">删除“{pendingDelete.name}”？</h3>
            <p>此操作会删除电脑上的接收文件。</p>
            <div className="deviceActions">
              <button className="secondaryButton" type="button" onClick={() => setPendingDelete(undefined)}>
                取消
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => {
                  onDeleteFile(pendingDelete.relativePath);
                  setPendingDelete(undefined);
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
