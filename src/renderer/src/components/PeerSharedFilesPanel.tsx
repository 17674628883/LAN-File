import { useState, type ReactElement } from "react";
import type { FileBrowserEntry, FileBrowserView } from "../../../shared/fileBrowserTypes";
import type { Peer } from "../api";
import { FileBrowser } from "./FileBrowser";

type PeerSharedFilesPanelProps = {
  peer?: Peer;
  entries: FileBrowserEntry[];
  loading: boolean;
  relativePath: string;
  onRefresh(): void;
  onOpenDirectory(relativePath: string): void;
  onDownloadFile(entry: FileBrowserEntry): void;
};

export function PeerSharedFilesPanel({
  peer,
  entries,
  loading,
  relativePath,
  onRefresh,
  onOpenDirectory,
  onDownloadFile
}: PeerSharedFilesPanelProps): ReactElement {
  const [view, setView] = useState<FileBrowserView>("list");

  return (
    <section className="panel" aria-labelledby="peer-shared-title">
      <header className="panelHeader">
        <div>
          <h2 id="peer-shared-title">对方共享文件</h2>
          <p className="folderPath">{peer ? peer.name : "未选择设备"}</p>
        </div>
      </header>
      <p className="fieldLabel">双击文件会下载到接收文件夹。</p>
      <FileBrowser
        entries={entries}
        loading={loading}
        location={{ source: "peer-shared", relativePath, peerDeviceId: peer?.deviceId }}
        view={view}
        onChangeView={setView}
        onOpenDirectory={onOpenDirectory}
        onOpenFile={onDownloadFile}
        onRefresh={onRefresh}
        onNavigate={onOpenDirectory}
      />
    </section>
  );
}
