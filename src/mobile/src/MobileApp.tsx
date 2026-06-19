import { useEffect, useState, type ReactElement } from "react";

const DEVICE_ID_STORAGE_KEY = "lanFileTransfer.deviceId";
const ACCESS_TOKEN_STORAGE_KEY = "lanFileTransfer.accessToken";

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
  const [entries, setEntries] = useState<SharedEntry[]>([]);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? "");

  useEffect(() => {
    let ignore = false;

    pairDevice()
      .then((token) => {
        if (!ignore) {
          setAccessToken(token);
        }

        return fetch("/api/shared/list", {
          headers: { authorization: `Bearer ${token}` }
        });
      })
      .then((response) => (response.ok ? response.json() : { entries: [] }))
      .then((body: { entries?: SharedEntry[] }) => {
        if (!ignore) {
          setEntries(body.entries ?? []);
        }
      })
      .catch(() => {
        if (!ignore) {
          setEntries([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const downloadAccessToken = encodeURIComponent(accessToken);

  return (
    <main className="mobileShell">
      <section className="uploadPanel" aria-labelledby="mobile-title">
        <h1 id="mobile-title">手机快传</h1>
        <form action="/api/upload" method="post" encType="multipart/form-data">
          <input type="file" name="files" multiple />
          <button type="submit">上传到电脑</button>
        </form>
      </section>

      <section className="sharedPanel" aria-labelledby="shared-title">
        <h2 id="shared-title">共享文件夹</h2>
        <ul>
          {entries.map((entry) => (
            <li key={entry.relativePath}>
              <a href={`/api/shared/download?path=${encodeURIComponent(entry.relativePath)}&accessToken=${downloadAccessToken}`}>
                {entry.name}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

async function pairDevice(): Promise<string> {
  const response = await fetch("/api/pair", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      deviceId: getOrCreateDeviceId(),
      displayName: "Mobile Browser",
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

  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, body.accessToken);
  return body.accessToken;
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
