import { Archive, File, FileText, Folder, Image, Music, Video, type LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import type { FileBrowserEntry, FileBrowserLocation, FileBrowserView } from "../../../shared/fileBrowserTypes";
import { FileBrowserToolbar } from "./FileBrowserToolbar";

type FileBrowserProps = {
  entries: FileBrowserEntry[];
  loading: boolean;
  location: FileBrowserLocation;
  view: FileBrowserView;
  onChangeView(view: FileBrowserView): void;
  onOpenDirectory(relativePath: string): void;
  onOpenFile(entry: FileBrowserEntry): void;
  onRefresh(): void;
  onNavigate?(relativePath: string): void;
};

export function FileBrowser({
  entries,
  loading,
  location,
  view,
  onChangeView,
  onOpenDirectory,
  onOpenFile,
  onRefresh,
  onNavigate
}: FileBrowserProps): ReactElement {
  const [query, setQuery] = useState("");
  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return entries;
    return entries.filter((entry) => entry.name.toLocaleLowerCase().includes(normalizedQuery));
  }, [entries, query]);

  const openEntry = (entry: FileBrowserEntry): void => {
    if (entry.kind === "directory") {
      onOpenDirectory(entry.relativePath);
      return;
    }

    onOpenFile(entry);
  };

  return (
    <section className="fileBrowser">
      <FileBrowserToolbar
        relativePath={location.relativePath}
        query={query}
        view={view}
        onNavigate={onNavigate ?? onOpenDirectory}
        onQueryChange={setQuery}
        onRefresh={onRefresh}
        onChangeView={onChangeView}
      />

      {loading ? <div className="fileState">正在加载...</div> : null}
      {!loading && visibleEntries.length === 0 ? <div className="fileState">没有文件</div> : null}
      {!loading && visibleEntries.length > 0 && view === "list" ? (
        <div className="fileList" role="table" aria-label="文件列表">
          <div className="fileHeader" role="row">
            <span>名称</span>
            <span>大小</span>
            <span>类型</span>
            <span>修改时间</span>
          </div>
          {visibleEntries.map((entry) => (
            <button
              key={entry.relativePath}
              className="fileRow"
              type="button"
              role="row"
              onClick={() => undefined}
              onDoubleClick={() => openEntry(entry)}
            >
              <span className="fileName">
                <EntryIcon entry={entry} />
                <span>{entry.name}</span>
              </span>
              <span>{formatSize(entry)}</span>
              <span>{formatKind(entry)}</span>
              <span>{formatModifiedAt(entry.modifiedAt)}</span>
            </button>
          ))}
        </div>
      ) : null}
      {!loading && visibleEntries.length > 0 && view === "grid" ? (
        <div className="fileGrid" aria-label="文件网格">
          {visibleEntries.map((entry) => (
            <button key={entry.relativePath} className="fileTile" type="button" onDoubleClick={() => openEntry(entry)}>
              <span className="fileTilePreview">
                <EntryIcon entry={entry} />
              </span>
              <span className="fileTileName">{entry.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EntryIcon({ entry }: { entry: FileBrowserEntry }): ReactElement {
  const Icon = getEntryIcon(entry);
  return <Icon size={20} aria-hidden={true} />;
}

function getEntryIcon(entry: FileBrowserEntry): LucideIcon {
  if (entry.kind === "directory") return Folder;
  if (entry.kind === "image") return Image;
  if (entry.kind === "video") return Video;
  if (entry.kind === "audio") return Music;
  if (entry.kind === "archive") return Archive;
  if (entry.kind === "document") return FileText;
  return File;
}

function formatSize(entry: FileBrowserEntry): string {
  if (entry.kind === "directory") return "-";
  if (entry.size < 1024) return `${entry.size} B`;
  if (entry.size < 1024 * 1024) return `${(entry.size / 1024).toFixed(1)} KB`;
  if (entry.size < 1024 * 1024 * 1024) return `${(entry.size / 1024 / 1024).toFixed(1)} MB`;
  return `${(entry.size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatKind(entry: FileBrowserEntry): string {
  const labels: Record<FileBrowserEntry["kind"], string> = {
    directory: "文件夹",
    image: "图片",
    video: "视频",
    audio: "音频",
    archive: "压缩包",
    document: "文档",
    other: "文件"
  };
  return labels[entry.kind];
}

function formatModifiedAt(modifiedAt: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(modifiedAt));
}
