import Bonjour, { type Browser, type Service } from "bonjour-service";

const SERVICE_TYPE = "lan-transfer";

export interface PeerInfo {
  name: string;
  host: string;
  port: number;
  deviceId: string;
}

export interface DiscoveryService {
  start(): void;
  stop(): void;
  onPeer(callback: (peer: PeerInfo) => void): () => void;
}

export interface DiscoveryServiceOptions {
  serviceName: string;
  port: number;
  deviceId: string;
}

export function createDiscoveryService(options: DiscoveryServiceOptions): DiscoveryService {
  const bonjour = new Bonjour();
  const callbacks = new Set<(peer: PeerInfo) => void>();
  let advertisement: Service | undefined;
  let browser: Browser | undefined;
  let started = false;
  let destroyed = false;

  const handlePeer = (service: Service): void => {
    const deviceId = readTxtValue(service.txt?.deviceId);
    if (!deviceId || deviceId === options.deviceId) {
      return;
    }

    const host = service.referer?.address ?? service.addresses?.find((address) => address.includes(".")) ?? service.host;
    const peer: PeerInfo = {
      name: service.name,
      host,
      port: service.port,
      deviceId
    };

    for (const callback of callbacks) {
      callback(peer);
    }
  };

  return {
    start(): void {
      if (started || destroyed) {
        return;
      }

      started = true;
      advertisement = bonjour.publish({
        name: options.serviceName,
        type: SERVICE_TYPE,
        port: options.port,
        txt: {
          deviceId: options.deviceId
        }
      });

      browser = bonjour.find({ type: SERVICE_TYPE }, handlePeer);
    },

    stop(): void {
      if (destroyed) {
        return;
      }

      browser?.stop();
      browser = undefined;
      advertisement?.stop();
      advertisement = undefined;
      started = false;
      destroyed = true;
      bonjour.destroy();
    },

    onPeer(callback: (peer: PeerInfo) => void): () => void {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    }
  };
}

function readTxtValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  return undefined;
}
