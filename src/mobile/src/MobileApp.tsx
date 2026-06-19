import { useEffect, useState, type ReactElement } from "react";

type SharedEntry = {
  name: string;
  relativePath: string;
  type: "file" | "directory";
};

export function MobileApp(): ReactElement {
  const [entries, setEntries] = useState<SharedEntry[]>([]);

  useEffect(() => {
    let ignore = false;

    fetch("/api/shared/list")
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
              <a href={`/api/shared/download?path=${encodeURIComponent(entry.relativePath)}`}>{entry.name}</a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
