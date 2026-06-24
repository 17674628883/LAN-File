// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FileBrowserEntry } from "../../src/shared/fileBrowserTypes";
import { ReceivedFilesPanel } from "../../src/renderer/src/components/ReceivedFilesPanel";
import { SharedFilesPanel } from "../../src/renderer/src/components/SharedFilesPanel";

const receivedEntries: FileBrowserEntry[] = [
  { name: "Photo.jpg", relativePath: "Photo.jpg", kind: "image", extension: ".jpg", size: 100, modifiedAt: 1 }
];

describe("local file panels", () => {
  it("received files exposes open folder and file actions", () => {
    render(
      <ReceivedFilesPanel
        entries={receivedEntries}
        loading={false}
        relativePath=""
        onRefresh={vi.fn()}
        onOpenFile={vi.fn()}
        onShowFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onOpenReceiveFolder={vi.fn()}
        onOpenDirectory={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "打开接收文件夹" })).toBeTruthy();
    expect(screen.getAllByText("Photo.jpg").length).toBeGreaterThan(0);
  });

  it("shared files exposes sharing toggle and folder actions", async () => {
    const user = userEvent.setup();
    const onEnabledChange = vi.fn();
    const onChooseRoot = vi.fn();
    const onOpenRoot = vi.fn();

    render(
      <SharedFilesPanel
        rootPath="D:\\Shared"
        enabled={true}
        entries={[]}
        loading={false}
        relativePath=""
        onEnabledChange={onEnabledChange}
        onChooseRoot={onChooseRoot}
        onOpenRoot={onOpenRoot}
        onRefresh={vi.fn()}
        onOpenDirectory={vi.fn()}
      />
    );

    expect(screen.getByText("允许已配对设备浏览我的共享文件夹")).toBeTruthy();
    expect(screen.getByText((text) => text.includes("Shared"))).toBeTruthy();

    await user.click(screen.getByLabelText("允许已配对设备浏览我的共享文件夹"));
    await user.click(screen.getByRole("button", { name: "更换文件夹" }));
    await user.click(screen.getByRole("button", { name: "打开文件夹" }));

    expect(onEnabledChange).toHaveBeenCalledWith(false);
    expect(onChooseRoot).toHaveBeenCalledTimes(1);
    expect(onOpenRoot).toHaveBeenCalledTimes(1);
  });

  it("confirms before deleting a received file", async () => {
    const user = userEvent.setup();
    const onDeleteFile = vi.fn();
    render(
      <ReceivedFilesPanel
        entries={receivedEntries}
        loading={false}
        relativePath=""
        onRefresh={vi.fn()}
        onOpenFile={vi.fn()}
        onShowFile={vi.fn()}
        onDeleteFile={onDeleteFile}
        onOpenReceiveFolder={vi.fn()}
        onOpenDirectory={vi.fn()}
      />
    );

    await user.click(screen.getAllByRole("button", { name: "删除" })[0]);

    expect(onDeleteFile).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "删除" })[1]);

    expect(onDeleteFile).toHaveBeenCalledWith("Photo.jpg");
  });

  it("uses the parent shared folder path for navigation", () => {
    const { rerender } = render(
      <SharedFilesPanel
        rootPath="D:\\Shared"
        enabled={true}
        entries={[]}
        loading={false}
        relativePath="old-folder"
        onEnabledChange={vi.fn()}
        onChooseRoot={vi.fn()}
        onOpenRoot={vi.fn()}
        onRefresh={vi.fn()}
        onOpenDirectory={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "old-folder" })).toBeTruthy();

    rerender(
      <SharedFilesPanel
        rootPath="E:\\NewShared"
        enabled={true}
        entries={[]}
        loading={false}
        relativePath=""
        onEnabledChange={vi.fn()}
        onChooseRoot={vi.fn()}
        onOpenRoot={vi.fn()}
        onRefresh={vi.fn()}
        onOpenDirectory={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "old-folder" })).toBeNull();
  });
});
