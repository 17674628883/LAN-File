import type { PeerInfo } from "./discovery";

export type ManualDiscoveryOptions = {
  host: string;
  port: number;
  currentDeviceId?: string;
  fetchImpl?: typeof fetch;
};

type DeviceResponse = {
  deviceId?: unknown;
  displayName?: unknown;
};

export async function discoverPeerManually({
  host,
  port,
  currentDeviceId,
  fetchImpl = fetch
}: ManualDiscoveryOptions): Promise<PeerInfo> {
  const normalizedHost = normalizeHost(host);
  const normalizedPort = normalizePort(port);
  const response = await fetchImpl(new URL("/api/device", `http://${formatHostForUrl(normalizedHost)}:${normalizedPort}`).toString(), {
    signal: AbortSignal.timeout(4_000)
  });

  if (!response.ok) {
    throw new Error(`未找到局域网快传：${response.status}`);
  }

  const device = (await response.json()) as DeviceResponse;
  const deviceId = typeof device.deviceId === "string" ? device.deviceId : "";
  const displayName = typeof device.displayName === "string" ? device.displayName : "";

  if (!deviceId || !displayName) {
    throw new Error("这个地址不是局域网快传设备。");
  }

  if (currentDeviceId && deviceId === currentDeviceId) {
    throw new Error("不能添加本机设备。");
  }

  return {
    name: displayName,
    host: normalizedHost,
    port: normalizedPort,
    deviceId
  };
}

function normalizeHost(host: string): string {
  const trimmedHost = host.trim();

  if (!trimmedHost) {
    throw new Error("请输入对方电脑的 IP 地址。");
  }

  return trimmedHost.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^\[(.*)\]$/, "$1").split(":")[0];
}

function normalizePort(port: number): number {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("端口号不正确。");
  }

  return port;
}

function formatHostForUrl(host: string): string {
  if (host.includes(":") && !host.startsWith("[") && !host.endsWith("]")) {
    return `[${host}]`;
  }

  return host;
}
