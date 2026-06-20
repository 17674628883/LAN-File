import { describe, expect, test } from "vitest";
import { createChineseMenuTemplate } from "../../src/main/core/appMenu";

describe("application menu", () => {
  test("uses Chinese labels for the native menu bar", () => {
    const template = createChineseMenuTemplate();

    expect(template.map((item) => item.label)).toEqual(["文件", "编辑", "查看", "窗口", "帮助"]);
    expect(collectLabels(template)).toEqual(
      expect.arrayContaining(["退出", "撤销", "重做", "剪切", "复制", "粘贴", "全选", "重新加载", "全屏", "最小化", "关闭窗口"])
    );
  });
});

function collectLabels(items: Array<{ label?: string; submenu?: unknown }>): string[] {
  return items.flatMap((item) => {
    const labels = item.label ? [item.label] : [];
    const submenu = Array.isArray(item.submenu) ? collectLabels(item.submenu as Array<{ label?: string; submenu?: unknown }>) : [];
    return [...labels, ...submenu];
  });
}
