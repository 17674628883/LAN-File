import path from "node:path";

export type ReceiveNotificationPayload = {
  title: string;
  body: string;
  absolutePath: string;
};

export function createReceiveNotification(file: { name: string; absolutePath: string }): ReceiveNotificationPayload {
  return {
    title: "文件接收完成",
    body: file.name,
    absolutePath: file.absolutePath
  };
}

export async function showReceiveNotification(file: { relativePath: string; absolutePath: string }): Promise<void> {
  const electronModule = await import("electron");
  const { Notification, shell } = electronModule.default ?? electronModule;

  if (!Notification.isSupported()) {
    return;
  }

  const payload = createReceiveNotification({
    name: path.basename(file.relativePath),
    absolutePath: file.absolutePath
  });
  const notification = new Notification({
    title: payload.title,
    body: payload.body
  });

  notification.on("click", () => {
    shell.showItemInFolder(payload.absolutePath);
  });
  notification.show();
}
