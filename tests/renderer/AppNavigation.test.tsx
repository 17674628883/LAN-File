// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppNavigation } from "../../src/renderer/src/components/AppNavigation";

describe("AppNavigation", () => {
  it("navigates to received files", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<AppNavigation activePage="home" deviceName="Office PC" onNavigate={onNavigate} />);

    await user.click(screen.getByRole("button", { name: /接收文件/ }));

    expect(onNavigate).toHaveBeenCalledWith("received");
  });
});
