import type { DeviceType } from "./trustedDevices";

export interface RemoteDeviceSummary {
  deviceId: string;
  displayName: string;
  deviceType: DeviceType;
}

export type PairingDecision = { action: "allow" } | { action: "confirm"; prompt: string };

export function getPairingDecision(remote: RemoteDeviceSummary, trusted: boolean): PairingDecision {
  if (trusted) {
    return { action: "allow" };
  }

  return {
    action: "confirm",
    prompt: `${remote.displayName} wants to connect to this computer.`
  };
}
