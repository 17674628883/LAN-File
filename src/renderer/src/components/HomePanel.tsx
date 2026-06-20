import type { ReactElement } from "react";
import type { FileBrowserEntry } from "../../../shared/fileBrowserTypes";
import type { AppStatus } from "../api";
import { RecentReceivedList } from "./RecentReceivedList";

type HomePanelProps = {
  status: AppStatus;
  recentReceived: FileBrowserEntry[];
  onOpenReceivedFile(relativePath: string): void;
  onShowReceivedFile(relativePath: string): void;
};

export function HomePanel({ status, recentReceived, onOpenReceivedFile, onShowReceivedFile }: HomePanelProps): ReactElement {
  const activeTransfers = status.transfers.filter((transfer) => transfer.status === "active").length;

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
        <RecentReceivedList
          entries={recentReceived}
          emptyText="暂无接收文件"
          onOpenFile={onOpenReceivedFile}
          onShowFile={onShowReceivedFile}
        />
      </section>
    </section>
  );
}
