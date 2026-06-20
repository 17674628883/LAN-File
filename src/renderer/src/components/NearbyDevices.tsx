import type { DragEvent, FormEvent, ReactElement } from "react";
import { useState } from "react";
import type { Peer } from "../api";
import { api } from "../api";
import { DeviceDropTarget } from "./DeviceDropTarget";

const DEFAULT_MANUAL_PORT = 43670;

type NearbyDevicesProps = {
  peers: Peer[];
  onManualSearch: (host: string, port: number) => Promise<void>;
  onPair: (deviceId: string) => void;
  onBrowseShared: (deviceId: string) => void;
  onSendFile: (deviceId: string) => void;
  onSendFolder: (deviceId: string) => void;
  onSendPaths: (deviceId: string, paths: string[]) => void;
};

export function NearbyDevices({
  peers,
  onManualSearch,
  onPair,
  onBrowseShared,
  onSendFile,
  onSendFolder,
  onSendPaths
}: NearbyDevicesProps): ReactElement {
  const [manualHost, setManualHost] = useState("");
  const [manualPort, setManualPort] = useState(String(DEFAULT_MANUAL_PORT));
  const [searching, setSearching] = useState(false);

  const getDroppedPaths = (event: DragEvent<HTMLElement>): string[] =>
    Array.from(event.dataTransfer.files)
      .map(api.getPathForDroppedFile)
      .filter((filePath) => filePath.length > 0);

  const submitManualSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const port = Number(manualPort);

    setSearching(true);
    onManualSearch(manualHost, port).finally(() => setSearching(false));
  };

  return (
    <section className="panel" aria-labelledby="nearby-devices-title">
      <header className="panelHeader">
        <h2 id="nearby-devices-title">附近设备</h2>
        <span className="countBadge">{peers.length}</span>
      </header>

      <form className="manualSearchPanel" onSubmit={submitManualSearch}>
        <input
          className="manualSearchInput"
          type="text"
          placeholder="对方电脑 IP，例如 192.168.1.20"
          value={manualHost}
          onChange={(event) => setManualHost(event.currentTarget.value)}
        />
        <input
          className="manualPortInput"
          type="number"
          min="1"
          max="65535"
          value={manualPort}
          aria-label="端口"
          onChange={(event) => setManualPort(event.currentTarget.value)}
        />
        <button className="primaryButton" type="submit" disabled={searching || manualHost.trim().length === 0}>
          {searching ? "搜索中" : "手动搜索"}
        </button>
      </form>

      {peers.length === 0 ? (
        <div className="emptyState">
          <p>同一局域网内的设备会显示在这里。</p>
        </div>
      ) : (
        <div className="rowList">
          {peers.map((peer) => (
            <div
              className="deviceRow"
              data-testid={`device-row-${peer.deviceId}`}
              key={peer.deviceId}
              onDragOver={(event) => {
                if (peer.paired) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!peer.paired) return;
                const paths = getDroppedPaths(event);
                if (paths.length > 0) {
                  onSendPaths(peer.deviceId, paths);
                }
              }}
            >
              <div className="deviceInfo">
                <strong>{peer.name}</strong>
                <span>
                  {peer.host}:{peer.port}
                </span>
              </div>
              <span className="deviceId">{peer.deviceId}</span>
              <span className="fieldLabel">{peer.paired ? "已配对" : "配对后才能发送"}</span>
              <div className="deviceActions">
                {!peer.paired ? (
                  <button className="primaryButton" type="button" onClick={() => onPair(peer.deviceId)}>
                    请求配对
                  </button>
                ) : null}
                {peer.paired ? (
                  <button className="secondaryButton" type="button" onClick={() => onBrowseShared(peer.deviceId)}>
                    浏览共享文件
                  </button>
                ) : null}
                <button
                  className="primaryButton"
                  disabled={!peer.paired}
                  title={peer.paired ? "发送文件" : "请先与此设备配对再发送文件。"}
                  type="button"
                  onClick={() => onSendFile(peer.deviceId)}
                >
                  发送文件
                </button>
                <button
                  className="secondaryButton"
                  disabled={!peer.paired}
                  title={peer.paired ? "发送文件夹" : "请先与此设备配对再发送文件夹。"}
                  type="button"
                  onClick={() => onSendFolder(peer.deviceId)}
                >
                  发送文件夹
                </button>
              </div>
              <DeviceDropTarget
                deviceName={peer.name}
                disabled={!peer.paired}
                getPathForFile={api.getPathForDroppedFile}
                onDropPaths={(paths) => onSendPaths(peer.deviceId, paths)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
