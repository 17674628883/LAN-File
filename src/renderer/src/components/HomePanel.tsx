import type { ReactElement } from "react";
import type { FileBrowserEntry } from "../../../shared/fileBrowserTypes";
import type { AppStatus } from "../api";

type HomePanelProps = {
  status: AppStatus;
  recentReceived: FileBrowserEntry[];
  onOpenReceivedFile(relativePath: string): void;
  onShowReceivedFile(relativePath: string): void;
};

export function HomePanel({ status, recentReceived, onOpenReceivedFile, onShowReceivedFile }: HomePanelProps): ReactElement {
  const activeTransfers = status.transfers.filter((transfer) => transfer.status === "active").length;
  const recentFiles = [...recentReceived].sort((left, right) => right.modifiedAt - left.modifiedAt).slice(0, 5);

  return (
    <section className="panel" aria-labelledby="home-title">
      <header className="panelHeader">
        <h2 id="home-title">首页</h2>
      </header>

      <div className="homeStats">
        <div className="statBlock">
          <span className="fieldLabel">本机</span>
          <strong>{status.deviceName || "本机设备"}</strong>
        </div>
        <div className="statBlock">
          <span className="fieldLabel">在线设备</span>
          <strong>{status.peers.length}</strong>
        </div>
        <div className="statBlock">
          <span className="fieldLabel">进行中</span>
          <strong>{activeTransfers}</strong>
        </div>
      </div>

      <section className="recentPanel" aria-labelledby="recent-received-title">
        <div className="panelHeader compact">
          <h3 id="recent-received-title">最近接收</h3>
        </div>
        {recentFiles.length === 0 ? (
          <div className="emptyState small">
            <p>暂无接收文件</p>
          </div>
        ) : (
          <div className="recentList">
            {recentFiles.map((entry) => (
              <div className="recentRow" key={entry.relativePath}>
                <span>{entry.name}</span>
                <div className="deviceActions">
                  <button className="secondaryButton" type="button" onClick={() => onOpenReceivedFile(entry.relativePath)}>
                    打开
                  </button>
                  <button className="secondaryButton" type="button" onClick={() => onShowReceivedFile(entry.relativePath)}>
                    打开所在位置
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
