// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "../../src/renderer/src/components/SettingsPanel";

describe("SettingsPanel", () => {
  it("shows the receive folder and exposes folder actions", async () => {
    const user = userEvent.setup();
    const onChooseReceiveFolder = vi.fn();
    const onOpenReceiveFolder = vi.fn();
    const onCheckForUpdates = vi.fn();
    const onInstallDownloadedUpdate = vi.fn();

    render(
      <SettingsPanel
        receiveFolder="D:\\Recv"
        updateState={{ status: "idle" }}
        onChooseReceiveFolder={onChooseReceiveFolder}
        onOpenReceiveFolder={onOpenReceiveFolder}
        onCheckForUpdates={onCheckForUpdates}
        onInstallDownloadedUpdate={onInstallDownloadedUpdate}
      />
    );

    expect(screen.getByRole("heading", { name: "设置" })).toBeTruthy();
    expect(screen.getByText("D:\\\\Recv")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "更改位置" }));
    await user.click(screen.getByRole("button", { name: "打开文件夹" }));

    expect(onChooseReceiveFolder).toHaveBeenCalledTimes(1);
    expect(onOpenReceiveFolder).toHaveBeenCalledTimes(1);
  });

  it("checks for updates and installs downloaded updates", async () => {
    const user = userEvent.setup();
    const onCheckForUpdates = vi.fn();
    const onInstallDownloadedUpdate = vi.fn();

    render(
      <SettingsPanel
        receiveFolder="D:\\Recv"
        updateState={{ status: "downloaded", version: "0.1.4" }}
        onChooseReceiveFolder={vi.fn()}
        onOpenReceiveFolder={vi.fn()}
        onCheckForUpdates={onCheckForUpdates}
        onInstallDownloadedUpdate={onInstallDownloadedUpdate}
      />
    );

    expect(screen.getByText("新版本 0.1.4 已下载，重启后完成安装。")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "检查更新" }));
    await user.click(screen.getByRole("button", { name: "重启安装" }));

    expect(onCheckForUpdates).toHaveBeenCalledTimes(1);
    expect(onInstallDownloadedUpdate).toHaveBeenCalledTimes(1);
  });
});
