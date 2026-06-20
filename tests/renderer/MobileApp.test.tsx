// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileApp } from "../../src/mobile/src/MobileApp";

describe("MobileApp", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders shared file metadata and enters directories", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ paired: true, accessToken: "token" }))
      .mockResolvedValueOnce(jsonResponse({ entries: [{ name: "Photos", relativePath: "Photos", kind: "directory", extension: "", size: 0, modifiedAt: 1 }] }))
      .mockResolvedValueOnce(jsonResponse({ entries: [{ name: "Photo.jpg", relativePath: "Photos/Photo.jpg", kind: "image", extension: ".jpg", size: 2048, modifiedAt: 2 }] }));

    render(<MobileApp />);

    await userEvent.click(await screen.findByRole("button", { name: /Photos/ }));

    expect(await screen.findByText("Photo.jpg")).toBeTruthy();
    expect(screen.getByText(/2.0 KB/)).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/shared/list?path=Photos", {
      headers: { authorization: "Bearer token" }
    });
  });

  it("shows a recoverable message when shared listing fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ paired: true, accessToken: "token" }))
      .mockRejectedValueOnce(new Error("offline"));

    render(<MobileApp />);

    expect(await screen.findByText("读取共享文件失败，请刷新重试。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "刷新" })).toBeTruthy();
  });
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init
  });
}
