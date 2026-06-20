import { describe, expect, it } from "vitest";
import { createInitialUpdateState, createUpdateStatusMessage } from "../../src/shared/updateTypes";

describe("update status", () => {
  it("starts idle and reports checking state in Chinese", () => {
    expect(createInitialUpdateState()).toEqual({ status: "idle" });
    expect(createUpdateStatusMessage({ status: "checking" })).toBe("正在检查更新...");
  });

  it("formats download progress and downloaded state", () => {
    expect(createUpdateStatusMessage({ status: "downloading", percent: 42.4 })).toBe("正在下载更新 42%");
    expect(createUpdateStatusMessage({ status: "downloaded", version: "0.1.4" })).toBe(
      "新版本 0.1.4 已下载，重启后完成安装。"
    );
  });
});
