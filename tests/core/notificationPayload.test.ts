import { expect, test } from "vitest";
import { createReceiveNotification } from "../../src/main/notifications";

test("creates a concise receive notification", () => {
  expect(createReceiveNotification({ name: "Photo.jpg", absolutePath: "C:\\Downloads\\Photo.jpg" })).toEqual({
    title: "文件接收完成",
    body: "Photo.jpg",
    absolutePath: "C:\\Downloads\\Photo.jpg"
  });
});
