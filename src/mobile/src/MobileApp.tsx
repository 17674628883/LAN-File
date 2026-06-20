import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";

const DEVICE_ID_STORAGE_KEY = "lanFileTransfer.deviceId";

type SharedEntry = {
  name: string;
  relativePath: string;
  type: "file" | "directory";
};

type PairResponse = {
  paired?: boolean;
  accessToken?: string;
};

export function MobileApp(): ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<SharedEntry[]>([]);
  const [accessToken, setAccessToken] = useState("");
  const [currentPath, setCurrentPath] = useState("");
  const [message, setMessage] = useState("正在连接电脑...");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let ignore = false;

    getInitialAccessToken()
      .then(async (token) => {
        if (ignore) return;
        setAccessToken(token);
        await loadSharedFolder(token, "", setEntries, setMessage);
      })
      .catch(() => {
        if (!ignore) setMessage("配对未通过，请在电脑上点击允许。");
      });

    return () => {
      ignore = true;
    };
  }, []);

  const openDirectory = async (relativePath: string): Promise<void> => {
    if (!accessToken) return;
    setCurrentPath(relativePath);
    await loadSharedFolder(accessToken, relativePath, setEntries, setMessage);
  };

  const refresh = async (): Promise<void> => {
    if (!accessToken) return;
    await loadSharedFolder(accessToken, currentPath, setEntries, setMessage);
  };

  const goUp = async (): Promise<void> => {
    const parentPath = currentPath.split("/").slice(0, -1).join("/");
    await openDirectory(parentPath);
  };

  const uploadFiles = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const files = fileInputRef.current?.files;

    if (!files || files.length === 0) {
      setMessage("请先选择文件。");
      return;
    }

    setUploading(true);
    setMessage("正在上传...");

    try {
      for (const file of Array.from(files)) {
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "content-type": "application/octet-stream",
            "x-device-id": getOrCreateDeviceId(),
            "x-file-name": encodeURIComponent(file.name)
          },
          body: file
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }
      }

      setMessage(`上传完成，共 ${files.length} 个文件。`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setMessage("上传失败，请检查电脑是否仍在线。");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mobileShell">
      <section className="uploadPanel" aria-labelledby="mobile-title">
        <h1 id="mobile-title">手机快传</h1>
        <form onSubmit={uploadFiles}>
          <input ref={fileInputRef} type="file" name="files" multiple />
          <button type="submit" disabled={uploading}>
            {uploading ? "正在上传" : "上传到电脑"}
          </button>
        </form>
        <p className="statusMessage" role="status">{message}</p>
      </section>

      <section className="sharedPanel" aria-labelledby="shared-title">
        <div className="sharedHeader">
          <div>
            <h2 id="shared-title">共享文件夹</h2>
            <p className="currentPath">{currentPath || "根目录"}</p>
          </div>
          <div className="sharedActions">
            <button type="button" disabled={!currentPath} onClick={goUp}>返回</button>
            <button type="button" disabled={!accessToken} onClick={refresh}>刷新</button>
          </div>
        </div>
        {entries.length === 0 ? <p className="emptyMessage">暂无可显示的文件。</p> : null}
        <ul>
          {entries.map((entry) => (
            <li key={entry.relativePath}>
              {entry.type === "directory" ? (
                <button className="entryButton" type="button" onClick={() => openDirectory(entry.relativePath)}>
                  {entry.name}
                </button>
              ) : (
                <a href={createDownloadUrl(entry.relativePath, accessToken)}>{entry.name}</a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

async function loadSharedFolder(
  accessToken: string,
  relativePath: string,
  setEntries: (entries: SharedEntry[]) => void,
  setMessage: (message: string) => void
): Promise<void> {
  const query = relativePath ? `?path=${encodeURIComponent(relativePath)}` : "";
  const response = await fetch(`/api/shared/list${query}`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });

  if (response.status === 404) {
    setEntries([]);
    setMessage("电脑尚未选择共享文件夹。");
    return;
  }

  if (!response.ok) {
    throw new Error(`Unable to load shared folder: ${response.status}`);
  }

  const body = (await response.json()) as { entries?: SharedEntry[] };
  setEntries(body.entries ?? []);
  setMessage("已连接电脑。");
}

function createDownloadUrl(relativePath: string, accessToken: string): string {
  return `/api/shared/download?path=${encodeURIComponent(relativePath)}&accessToken=${encodeURIComponent(accessToken)}`;
}

async function pairDevice(): Promise<string> {
  const response = await fetch("/api/pair", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      deviceId: getOrCreateDeviceId(),
      displayName: "手机浏览器",
      deviceType: "phone"
    })
  });

  if (!response.ok) {
    throw new Error("Pairing was not accepted.");
  }

  const body = (await response.json()) as PairResponse;

  if (body.paired !== true || !body.accessToken) {
    throw new Error("Pairing response did not include an access token.");
  }

  return body.accessToken;
}

function getInitialAccessToken(): Promise<string> {
  const accessToken = new URLSearchParams(window.location.search).get("accessToken");
  return accessToken ? Promise.resolve(accessToken) : pairDevice();
}

function getOrCreateDeviceId(): string {
  const existingDeviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const deviceId = `dev_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
}
