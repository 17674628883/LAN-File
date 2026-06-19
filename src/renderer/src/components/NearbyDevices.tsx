import type { ReactElement } from "react";
import type { Peer } from "../api";

type NearbyDevicesProps = {
  peers: Peer[];
  onSendFile: (deviceId: string) => void;
};

export function NearbyDevices({ peers, onSendFile }: NearbyDevicesProps): ReactElement {
  return (
    <section className="panel" aria-labelledby="nearby-devices-title">
      <header className="panelHeader">
        <h2 id="nearby-devices-title">附近设备</h2>
        <span className="countBadge">{peers.length}</span>
      </header>

      {peers.length === 0 ? (
        <div className="emptyState">
          <p>同一局域网内的设备会显示在这里。</p>
        </div>
      ) : (
        <div className="rowList">
          {peers.map((peer) => (
            <div className="deviceRow" key={peer.deviceId}>
              <div className="deviceInfo">
                <strong>{peer.name}</strong>
                <span>
                  {peer.host}:{peer.port}
                </span>
              </div>
              <span className="deviceId">{peer.deviceId}</span>
              <span className="fieldLabel">{peer.paired ? "已配对" : "配对后才能发送"}</span>
              <button
                className="primaryButton"
                disabled={!peer.paired}
                title={peer.paired ? "发送文件" : "请先与此设备配对再发送文件。"}
                type="button"
                onClick={() => onSendFile(peer.deviceId)}
              >
                发送文件
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
