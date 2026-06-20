import { describe, expect, test, vi } from "vitest";
import { requestPeerPairing } from "../../src/main/core/pairingClient";

describe("desktop pairing client", () => {
  test("sends this computer identity to the selected peer", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ paired: true, accessToken: "token" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const paired = await requestPeerPairing(
      { deviceId: "peer-1", name: "Office PC", host: "192.168.1.20", port: 43670 },
      { deviceId: "local-1", displayName: "Home PC" },
      fetchImpl
    );

    expect(paired).toEqual({ paired: true, accessToken: "token" });
    expect(fetchImpl).toHaveBeenCalledWith("http://192.168.1.20:43670/api/pair", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: "local-1", displayName: "Home PC", deviceType: "desktop" })
    });
  });

  test("returns false when the other computer rejects pairing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ paired: false }), { status: 403 }));

    await expect(
      requestPeerPairing(
        { deviceId: "peer-1", name: "Office PC", host: "192.168.1.20", port: 43670 },
        { deviceId: "local-1", displayName: "Home PC" },
        fetchImpl
      )
    ).resolves.toEqual({ paired: false });
  });
});
