export type DeviceType = "desktop" | "phone";

export interface TrustedDeviceRecord {
  deviceId: string;
  displayName: string;
  deviceType: DeviceType;
  trustedAt: number;
  lastSeenAt: number;
}

export interface TrustedDevicesStore {
  get(): TrustedDeviceRecord[];
  set(value: TrustedDeviceRecord[]): void;
}

export interface TrustedDeviceStoreApi {
  list(): TrustedDeviceRecord[];
  trust(record: TrustedDeviceRecord): void;
  remove(deviceId: string): void;
  isTrusted(deviceId: string): boolean;
}

export function createTrustedDeviceStore(store: TrustedDevicesStore): TrustedDeviceStoreApi {
  return {
    list() {
      return store
        .get()
        .map(cloneTrustedDeviceRecord)
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    },
    trust(record) {
      const records = store.get().filter((device) => device.deviceId !== record.deviceId);
      store.set([...records.map(cloneTrustedDeviceRecord), cloneTrustedDeviceRecord(record)]);
    },
    remove(deviceId) {
      store.set(store.get().filter((device) => device.deviceId !== deviceId).map(cloneTrustedDeviceRecord));
    },
    isTrusted(deviceId) {
      return store.get().some((device) => device.deviceId === deviceId);
    }
  };
}

function cloneTrustedDeviceRecord(record: TrustedDeviceRecord): TrustedDeviceRecord {
  return { ...record };
}
