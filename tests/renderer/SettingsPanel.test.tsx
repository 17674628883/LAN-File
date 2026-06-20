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

    render(
      <SettingsPanel
        receiveFolder="D:\\Recv"
        onChooseReceiveFolder={onChooseReceiveFolder}
        onOpenReceiveFolder={onOpenReceiveFolder}
      />
    );

    expect(screen.getByRole("heading", { name: "设置" })).toBeTruthy();
    expect(screen.getByText("D:\\\\Recv")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "更改位置" }));
    await user.click(screen.getByRole("button", { name: "打开文件夹" }));

    expect(onChooseReceiveFolder).toHaveBeenCalledTimes(1);
    expect(onOpenReceiveFolder).toHaveBeenCalledTimes(1);
  });
});
