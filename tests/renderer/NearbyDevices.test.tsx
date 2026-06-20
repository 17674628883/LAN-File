// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
        onManualSearch={vi.fn()}
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

  it("submits a manual peer search by host and port", async () => {
    const user = userEvent.setup();
    const onManualSearch = vi.fn(async () => undefined);

    render(
      <NearbyDevices
        peers={[]}
        onManualSearch={onManualSearch}
        onPair={vi.fn()}
        onBrowseShared={vi.fn()}
        onSendFile={vi.fn()}
        onSendFolder={vi.fn()}
        onSendPaths={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("对方电脑 IP，例如 192.168.1.20"), "192.168.1.20");
    await user.clear(screen.getByLabelText("端口"));
    await user.type(screen.getByLabelText("端口"), "43671");
    await user.click(screen.getByRole("button", { name: "手动搜索" }));

    expect(onManualSearch).toHaveBeenCalledWith("192.168.1.20", 43671);
  });
});
