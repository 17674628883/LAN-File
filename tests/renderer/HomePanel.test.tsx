// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FileBrowserEntry } from "../../src/shared/fileBrowserTypes";
import { HomePanel } from "../../src/renderer/src/components/HomePanel";
import type { AppStatus } from "../../src/renderer/src/api";

const status: AppStatus = {
  deviceName: "Office PC",
  lanUrl: "",
  mobileUrl: "",
  peers: [],
  transfers: []
};

function file(name: string, modifiedAt: number): FileBrowserEntry {
  return { name, relativePath: name, kind: "document", extension: ".txt", size: 1, modifiedAt };
}

describe("HomePanel", () => {
  it("shows the five most recent received files with Chinese actions", async () => {
    const user = userEvent.setup();
    const onOpenReceivedFile = vi.fn();
    const onShowReceivedFile = vi.fn();

    render(
      <HomePanel
        status={status}
        recentReceived={[
          file("old.txt", 1),
          file("newest.txt", 7),
          file("two.txt", 6),
          file("three.txt", 5),
          file("four.txt", 4),
          file("five.txt", 3)
        ]}
        onOpenReceivedFile={onOpenReceivedFile}
        onShowReceivedFile={onShowReceivedFile}
      />
    );

    expect(screen.getByRole("heading", { name: "最近接收" })).toBeTruthy();
    expect(screen.getByText("newest.txt")).toBeTruthy();
    expect(screen.queryByText("old.txt")).toBeNull();

    await user.click(screen.getAllByRole("button", { name: "打开" })[0]);
    await user.click(screen.getAllByRole("button", { name: "打开所在位置" })[0]);

    expect(onOpenReceivedFile).toHaveBeenCalledWith("newest.txt");
    expect(onShowReceivedFile).toHaveBeenCalledWith("newest.txt");
  });
});
