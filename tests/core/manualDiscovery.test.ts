import { describe, expect, it, vi } from "vitest";
import { discoverPeerManually } from "../../src/main/core/manualDiscovery";

describe("manual peer discovery", () => {
  it("loads peer identity from a manually entered host and port", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ deviceId: "peer-1", displayName: "Office PC" })
    })) as unknown as typeof fetch;

    await expect(discoverPeerManually({ host: "192.168.1.20", port: 43670, currentDeviceId: "self", fetchImpl })).resolves.toEqual({
      deviceId: "peer-1",
      host: "192.168.1.20",
      name: "Office PC",
      port: 43670
    });
    expect(fetchImpl).toHaveBeenCalledWith("http://192.168.1.20:43670/api/device", expect.any(Object));
  });

  it("does not add this computer as a peer", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ deviceId: "self", displayName: "My PC" })
    })) as unknown as typeof fetch;

    await expect(discoverPeerManually({ host: "127.0.0.1", port: 43670, currentDeviceId: "self", fetchImpl })).rejects.toThrow(
      "不能添加本机设备。"
    );
  });
});
