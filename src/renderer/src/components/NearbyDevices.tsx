import type { ReactElement } from "react";
import type { Peer } from "../api";

type NearbyDevicesProps = {
  peers: Peer[];
};

export function NearbyDevices({ peers }: NearbyDevicesProps): ReactElement {
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
              <div>
                <strong>{peer.name}</strong>
                <span>
                  {peer.host}:{peer.port}
                </span>
              </div>
              <span className="deviceId">{peer.deviceId}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
