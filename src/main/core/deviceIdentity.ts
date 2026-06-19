import { randomBytes, randomUUID } from "node:crypto";

export interface DeviceIdentity {
  deviceId: string;
  secret: string;
  displayName: string;
  createdAt: number;
}

export interface IdentityStore {
  get(): unknown;
  set(value: unknown): void;
}

export function createDeviceIdentity(displayName: string): DeviceIdentity {
  return {
    deviceId: `dev_${randomUUID()}`,
    secret: `sec_${randomBytes(32).toString("hex")}`,
    displayName,
    createdAt: Date.now()
  };
}

export function loadOrCreateDeviceIdentity(store: IdentityStore, displayName: string): DeviceIdentity {
  const existing = store.get();

  if (isDeviceIdentity(existing)) {
    return existing;
  }

  const identity = createDeviceIdentity(displayName);
  store.set(identity);
  return identity;
}

function isDeviceIdentity(value: unknown): value is DeviceIdentity {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<DeviceIdentity>;
  return (
    typeof candidate.deviceId === "string" &&
    /^dev_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate.deviceId) &&
    typeof candidate.secret === "string" &&
    /^sec_[a-f0-9]{64}$/i.test(candidate.secret) &&
    typeof candidate.displayName === "string" &&
    candidate.displayName.length > 0 &&
    typeof candidate.createdAt === "number" &&
    Number.isFinite(candidate.createdAt) &&
    candidate.createdAt > 0
  );
}
