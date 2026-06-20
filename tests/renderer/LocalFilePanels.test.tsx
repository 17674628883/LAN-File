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
        onRefresh={vi.fn()}
        onOpenFile={vi.fn()}
        onShowFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onOpenReceiveFolder={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "打开接收文件夹" })).toBeTruthy();
    expect(screen.getAllByText("Photo.jpg").length).toBeGreaterThan(0);
  });

  it("shared files explains read-only access", () => {
    render(
      <SharedFilesPanel rootPath="D:\\Shared" entries={[]} loading={false} onChooseRoot={vi.fn()} onRefresh={vi.fn()} />
    );

    expect(screen.getByText("远程设备只能浏览和下载，不能修改这里的文件。")).toBeTruthy();
  });

  it("confirms before deleting a received file", async () => {
    const user = userEvent.setup();
    const onDeleteFile = vi.fn();
    render(
      <ReceivedFilesPanel
        entries={receivedEntries}
        loading={false}
        onRefresh={vi.fn()}
        onOpenFile={vi.fn()}
        onShowFile={vi.fn()}
        onDeleteFile={onDeleteFile}
        onOpenReceiveFolder={vi.fn()}
      />
    );

    await user.click(screen.getAllByRole("button", { name: "删除" })[0]);

    expect(onDeleteFile).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "删除" })[1]);

    expect(onDeleteFile).toHaveBeenCalledWith("Photo.jpg");
  });
});
