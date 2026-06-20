// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Peer } from "../../src/renderer/src/api";
import { NearbyDevices } from "../../src/renderer/src/components/NearbyDevices";

vi.mock("../../src/renderer/src/api", () => ({
  api: {
    getPathForDroppedFile: vi.fn(() => "C:\\Temp\\hello.txt")
  }
}));

const pairedPeer: Peer = {
  name: "Office PC",
  host: "192.168.1.20",
  port: 43670,
  deviceId: "peer-1",
  paired: true
};

describe("NearbyDevices", () => {
  it("sends files dropped anywhere on a paired device row", () => {
    const onSendPaths = vi.fn();
    render(
      <NearbyDevices
        peers={[pairedPeer]}
        onPair={vi.fn()}
        onBrowseShared={vi.fn()}
        onSendFile={vi.fn()}
        onSendFolder={vi.fn()}
        onSendPaths={onSendPaths}
      />
    );

    fireEvent.drop(screen.getByTestId("device-row-peer-1"), {
      dataTransfer: { files: [new File(["hello"], "hello.txt")] }
    });

    expect(onSendPaths).toHaveBeenCalledWith("peer-1", ["C:\\Temp\\hello.txt"]);
  });
});
