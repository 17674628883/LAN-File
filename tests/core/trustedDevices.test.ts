import { describe, expect, it } from "vitest";
import { createTrustedDeviceStore, type TrustedDeviceRecord, type TrustedDevicesStore } from "../../src/main/core/trustedDevices";

class MemoryTrustedDevicesStore implements TrustedDevicesStore {
  value: TrustedDeviceRecord[] = [];
  get(): TrustedDeviceRecord[] {
    return this.value;
  }
  set(value: TrustedDeviceRecord[]): void {
    this.value = value;
  }
}

describe("trusted devices", () => {
  it("trusts and finds a device by id", () => {
    const backing = new MemoryTrustedDevicesStore();
    const store = createTrustedDeviceStore(backing);

    store.trust({
      deviceId: "dev_peer",
      displayName: "Peer PC",
      deviceType: "desktop",
      trustedAt: 100,
      lastSeenAt: 100
    });

    expect(store.isTrusted("dev_peer")).toBe(true);
    expect(store.list()).toHaveLength(1);
  });

  it("updates an existing trusted device instead of duplicating it", () => {
    const backing = new MemoryTrustedDevicesStore();
    const store = createTrustedDeviceStore(backing);

    store.trust({ deviceId: "dev_peer", displayName: "Old", deviceType: "desktop", trustedAt: 100, lastSeenAt: 100 });
    store.trust({ deviceId: "dev_peer", displayName: "New", deviceType: "desktop", trustedAt: 100, lastSeenAt: 200 });

    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].displayName).toBe("New");
    expect(store.list()[0].lastSeenAt).toBe(200);
  });

  it("lists trusted devices by most recently seen first", () => {
    const backing = new MemoryTrustedDevicesStore();
    const store = createTrustedDeviceStore(backing);

    store.trust({ deviceId: "dev_old", displayName: "Old", deviceType: "desktop", trustedAt: 100, lastSeenAt: 100 });
    store.trust({ deviceId: "dev_new", displayName: "New", deviceType: "phone", trustedAt: 100, lastSeenAt: 300 });
    store.trust({ deviceId: "dev_mid", displayName: "Mid", deviceType: "desktop", trustedAt: 100, lastSeenAt: 200 });

    expect(store.list().map((device) => device.deviceId)).toEqual(["dev_new", "dev_mid", "dev_old"]);
  });

  it("does not let later mutations of the trusted record change stored state", () => {
    const backing = new MemoryTrustedDevicesStore();
    const store = createTrustedDeviceStore(backing);
    const record: TrustedDeviceRecord = {
      deviceId: "dev_peer",
      displayName: "Peer PC",
      deviceType: "desktop",
      trustedAt: 100,
      lastSeenAt: 100
    };

    store.trust(record);
    record.displayName = "Mutated";
    record.lastSeenAt = 200;

    expect(store.list()[0].displayName).toBe("Peer PC");
    expect(store.list()[0].lastSeenAt).toBe(100);
  });

  it("does not let mutations of listed records change stored state", () => {
    const backing = new MemoryTrustedDevicesStore();
    const store = createTrustedDeviceStore(backing);

    store.trust({ deviceId: "dev_peer", displayName: "Peer PC", deviceType: "desktop", trustedAt: 100, lastSeenAt: 100 });

    const listed = store.list();
    listed[0].displayName = "Mutated";
    listed[0].lastSeenAt = 200;

    expect(store.list()[0].displayName).toBe("Peer PC");
    expect(store.list()[0].lastSeenAt).toBe(100);
  });

  it("removes trust for a device", () => {
    const backing = new MemoryTrustedDevicesStore();
    const store = createTrustedDeviceStore(backing);

    store.trust({ deviceId: "dev_peer", displayName: "Peer PC", deviceType: "desktop", trustedAt: 100, lastSeenAt: 100 });
    store.remove("dev_peer");

    expect(store.isTrusted("dev_peer")).toBe(false);
  });
});
