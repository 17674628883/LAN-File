// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileBrowser } from "../../src/renderer/src/components/FileBrowser";
import type { FileBrowserEntry } from "../../src/shared/fileBrowserTypes";

const entries: FileBrowserEntry[] = [
  { name: "Photos", relativePath: "Photos", kind: "directory", extension: "", size: 0, modifiedAt: 1 },
  { name: "Photo.jpg", relativePath: "Photo.jpg", kind: "image", extension: ".jpg", size: 2048, modifiedAt: 2 }
];

describe("FileBrowser", () => {
  it("opens a directory and switches to grid view", async () => {
    const user = userEvent.setup();
    const onOpenDirectory = vi.fn();
    const onChangeView = vi.fn();

    render(
      <FileBrowser
        entries={entries}
        loading={false}
        location={{ source: "shared-local", relativePath: "" }}
        view="list"
        onChangeView={onChangeView}
        onOpenDirectory={onOpenDirectory}
        onOpenFile={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    await user.dblClick(screen.getByText("Photos"));
    await user.click(screen.getByRole("button", { name: "网格视图" }));

    expect(onOpenDirectory).toHaveBeenCalledWith("Photos");
    expect(onChangeView).toHaveBeenCalledWith("grid");
  });

  it("filters entries by search query", async () => {
    const user = userEvent.setup();
    render(
      <FileBrowser
        entries={entries}
        loading={false}
        location={{ source: "shared-local", relativePath: "" }}
        view="list"
        onChangeView={vi.fn()}
        onOpenDirectory={vi.fn()}
        onOpenFile={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("搜索文件"), "photo.jpg");

    expect(screen.getByText("Photo.jpg")).toBeTruthy();
    expect(screen.queryByText("Photos")).toBeNull();
  });

  it("opens files, refreshes, and navigates with breadcrumbs", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();
    const onRefresh = vi.fn();
    const onNavigate = vi.fn();

    render(
      <FileBrowser
        entries={entries}
        loading={false}
        location={{ source: "shared-local", relativePath: "Albums/June" }}
        view="list"
        onChangeView={vi.fn()}
        onOpenDirectory={vi.fn()}
        onOpenFile={onOpenFile}
        onRefresh={onRefresh}
        onNavigate={onNavigate}
      />
    );

    await user.dblClick(screen.getByText("Photo.jpg"));
    await user.click(screen.getByRole("button", { name: "刷新" }));
    await user.click(screen.getByRole("button", { name: "Albums" }));
    await user.click(screen.getByRole("button", { name: "根目录" }));

    expect(onOpenFile).toHaveBeenCalledWith(entries[1]);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("Albums");
    expect(onNavigate).toHaveBeenCalledWith("");
  });
});
