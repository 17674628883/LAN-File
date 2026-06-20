import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import type { FileBrowserEntry, FileBrowserView } from "../../shared/fileBrowserTypes";

const DEVICE_ID_STORAGE_KEY = "lanFileTransfer.deviceId";

type PairResponse = {
  paired?: boolean;
  accessToken?: string;
};

export function MobileApp(): ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileBrowserEntry[]>([]);
  const [accessToken, setAccessToken] = useState("");
  const [currentPath, setCurrentPath] = useState("");
  const [message, setMessage] = useState("正在连接电脑...");
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<FileBrowserView>("list");
  const [uploadFailed, setUploadFailed] = useState(false);

  useEffect(() => {
    let ignore = false;

    getInitialAccessToken()
      .then(async (token) => {
        if (ignore) return;
        setAccessToken(token);
        await safelyLoadSharedFolder(token, "", setEntries, setMessage);
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
    await safelyLoadSharedFolder(accessToken, relativePath, setEntries, setMessage);
  };

  const refresh = async (): Promise<void> => {
    if (!accessToken) return;
    await safelyLoadSharedFolder(accessToken, currentPath, setEntries, setMessage);
  };

  const repairPairing = async (): Promise<void> => {
    setMessage("正在重新配对...");
    const token = await pairDevice();
    setAccessToken(token);
    await safelyLoadSharedFolder(token, currentPath, setEntries, setMessage);
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
    setUploadFailed(false);
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
      setUploadFailed(true);
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
          {uploadFailed ? (
            <button type="submit" disabled={uploading}>
              重试上传
            </button>
          ) : null}
        </form>
        <p className="statusMessage" role="status">{message}</p>
      </section>

      <section className="sharedPanel" aria-labelledby="shared-title">
        <div className="sharedHeader">
          <div>
            <h2 id="shared-title">共享文件</h2>
            <p className="currentPath">{currentPath || "根目录"}</p>
          </div>
          <div className="sharedActions">
            <button type="button" disabled={!currentPath} onClick={goUp}>返回</button>
            <button type="button" disabled={!accessToken} onClick={refresh}>刷新</button>
            <button type="button" onClick={repairPairing}>重新配对</button>
          </div>
        </div>
        <div className="viewSwitch" role="group" aria-label="视图">
          <button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}>列表</button>
          <button className={view === "grid" ? "active" : ""} type="button" onClick={() => setView("grid")}>网格</button>
        </div>
        {entries.length === 0 ? <p className="emptyMessage">暂无可显示的文件。</p> : null}
        <ul className={view === "grid" ? "entryGrid" : "entryList"}>
          {entries.map((entry) => (
            <li key={entry.relativePath}>
              {entry.kind === "directory" ? (
                <button className="entryButton" type="button" onClick={() => openDirectory(entry.relativePath)}>
                  <span>{entry.name}</span>
                  <small>文件夹</small>
                </button>
              ) : (
                <a className="entryLink" href={createDownloadUrl(entry.relativePath, accessToken)}>
                  <span>{entry.name}</span>
                  <small>{formatSize(entry.size)} · {formatModifiedAt(entry.modifiedAt)}</small>
                </a>
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
  setEntries: (entries: FileBrowserEntry[]) => void,
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

  if (response.status === 403) {
    setEntries([]);
    setMessage("配对已失效，请重新配对。");
    return;
  }

  if (!response.ok) {
    setEntries([]);
    setMessage("读取共享文件失败，请刷新重试。");
    return;
  }

  const body = (await response.json()) as { entries?: FileBrowserEntry[] };
  setEntries(body.entries ?? []);
  setMessage("已连接电脑。");
}

async function safelyLoadSharedFolder(
  accessToken: string,
  relativePath: string,
  setEntries: (entries: FileBrowserEntry[]) => void,
  setMessage: (message: string) => void
): Promise<void> {
  try {
    await loadSharedFolder(accessToken, relativePath, setEntries, setMessage);
  } catch {
    setEntries([]);
    setMessage("读取共享文件失败，请刷新重试。");
  }
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

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatModifiedAt(modifiedAt: number): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(modifiedAt)
  );
}
