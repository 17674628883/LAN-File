import { describe, expect, it } from "vitest";
import { getPairingDecision, type RemoteDeviceSummary } from "../../src/main/core/pairing";

describe("pairing decisions", () => {
  const remote: RemoteDeviceSummary = {
    deviceId: "dev_peer",
    displayName: "Peer PC",
    deviceType: "desktop"
  };

  it("allows a trusted remote device", () => {
    const decision = getPairingDecision(remote, true);

    expect(decision).toEqual({ action: "allow" });
  });

  it("asks for confirmation for an untrusted remote device", () => {
    const decision = getPairingDecision(remote, false);

    expect(decision).toEqual({
      action: "confirm",
      prompt: "Peer PC wants to connect to this computer."
    });
  });
});
