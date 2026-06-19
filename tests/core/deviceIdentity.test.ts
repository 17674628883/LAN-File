import { describe, expect, it } from "vitest";
import { createDeviceIdentity, loadOrCreateDeviceIdentity, type IdentityStore } from "../../src/main/core/deviceIdentity";

class MemoryIdentityStore implements IdentityStore {
  value: unknown;
  get(): unknown {
    return this.value;
  }
  set(value: unknown): void {
    this.value = value;
  }
}

const validStoredIdentity = {
  deviceId: "dev_123e4567-e89b-42d3-a456-426614174000",
  secret: `sec_${"a".repeat(64)}`,
  displayName: "Stored PC",
  createdAt: 100
};

function expectValidNewIdentity(identity: ReturnType<typeof loadOrCreateDeviceIdentity>, displayName = "Office PC"): void {
  expect(identity.deviceId).toMatch(/^dev_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(identity.secret).toMatch(/^sec_[a-f0-9]{64}$/i);
  expect(identity.displayName).toBe(displayName);
  expect(Number.isFinite(identity.createdAt)).toBe(true);
  expect(identity.createdAt).toBeGreaterThan(0);
}

describe("device identity", () => {
  it("creates a stable identity shape", () => {
    const identity = createDeviceIdentity("Office PC");

    expect(identity.deviceId).toMatch(/^dev_/);
    expect(identity.secret).toMatch(/^sec_/);
    expect(identity.displayName).toBe("Office PC");
    expect(identity.createdAt).toBeGreaterThan(0);
  });

  it("loads an existing identity instead of creating a new one", () => {
    const store = new MemoryIdentityStore();
    const first = loadOrCreateDeviceIdentity(store, "Office PC");
    const second = loadOrCreateDeviceIdentity(store, "Renamed PC");

    expect(second).toEqual(first);
  });

  it.each([
    {
      name: "missing deviceId prefix",
      storedIdentity: { ...validStoredIdentity, deviceId: "not-prefixed" },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(identity.deviceId).not.toBe("not-prefixed");
      }
    },
    {
      name: "empty deviceId prefix",
      storedIdentity: { ...validStoredIdentity, deviceId: "dev_" },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(identity.deviceId).not.toBe("dev_");
      }
    },
    {
      name: "non-UUID deviceId",
      storedIdentity: { ...validStoredIdentity, deviceId: "dev_not-a-uuid" },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(identity.deviceId).not.toBe("dev_not-a-uuid");
      }
    },
    {
      name: "missing secret prefix",
      storedIdentity: { ...validStoredIdentity, secret: "not-prefixed" },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(identity.secret).not.toBe("not-prefixed");
      }
    },
    {
      name: "empty secret prefix",
      storedIdentity: { ...validStoredIdentity, secret: "sec_" },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(identity.secret).not.toBe("sec_");
      }
    },
    {
      name: "non-hex secret",
      storedIdentity: { ...validStoredIdentity, secret: "sec_not-hex" },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(identity.secret).not.toBe("sec_not-hex");
      }
    },
    {
      name: "too-short secret",
      storedIdentity: { ...validStoredIdentity, secret: `sec_${"a".repeat(63)}` },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(identity.secret).not.toBe(`sec_${"a".repeat(63)}`);
      }
    },
    {
      name: "empty displayName",
      storedIdentity: { ...validStoredIdentity, displayName: "" },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(identity.displayName).not.toBe("");
      }
    },
    {
      name: "NaN createdAt",
      storedIdentity: { ...validStoredIdentity, createdAt: Number.NaN },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(Number.isNaN(identity.createdAt)).toBe(false);
      }
    },
    {
      name: "Infinity createdAt",
      storedIdentity: { ...validStoredIdentity, createdAt: Infinity },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(identity.createdAt).not.toBe(Infinity);
      }
    },
    {
      name: "zero createdAt",
      storedIdentity: { ...validStoredIdentity, createdAt: 0 },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(identity.createdAt).not.toBe(0);
      }
    },
    {
      name: "negative createdAt",
      storedIdentity: { ...validStoredIdentity, createdAt: -1 },
      assertInvalidValueNotReturned: (identity: ReturnType<typeof loadOrCreateDeviceIdentity>) => {
        expect(identity.createdAt).not.toBe(-1);
      }
    }
  ])("replaces an invalid stored identity with a new valid identity: $name", ({ storedIdentity, assertInvalidValueNotReturned }) => {
    const store = new MemoryIdentityStore();
    store.set(storedIdentity);

    const identity = loadOrCreateDeviceIdentity(store, "Office PC");

    assertInvalidValueNotReturned(identity);
    expect(identity).not.toEqual(storedIdentity);
    expectValidNewIdentity(identity);
    expect(store.get()).toEqual(identity);
  });
});
