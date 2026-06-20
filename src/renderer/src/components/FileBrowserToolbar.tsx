import { Grid3X3, List, RefreshCw } from "lucide-react";
import type { ReactElement } from "react";
import type { FileBrowserView } from "../../../shared/fileBrowserTypes";

type FileBrowserToolbarProps = {
  relativePath: string;
  query: string;
  view: FileBrowserView;
  onNavigate(path: string): void;
  onQueryChange(query: string): void;
  onRefresh(): void;
  onChangeView(view: FileBrowserView): void;
};

export function FileBrowserToolbar({
  relativePath,
  query,
  view,
  onNavigate,
  onQueryChange,
  onRefresh,
  onChangeView
}: FileBrowserToolbarProps): ReactElement {
  const parts = relativePath ? relativePath.split("/") : [];

  return (
    <div className="fileToolbar">
      <nav className="breadcrumbs" aria-label="当前位置">
        <button type="button" onClick={() => onNavigate("")}>
          根目录
        </button>
        {parts.map((part, index) => {
          const targetPath = parts.slice(0, index + 1).join("/");
          return (
            <button key={targetPath} type="button" onClick={() => onNavigate(targetPath)}>
              {part}
            </button>
          );
        })}
      </nav>

      <div className="fileTools">
        <input
          className="fileSearch"
          type="search"
          placeholder="搜索文件"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
        />
        <button className="iconButton" type="button" title="刷新" aria-label="刷新" onClick={onRefresh}>
          <RefreshCw size={18} aria-hidden="true" />
        </button>
        <button
          className={view === "list" ? "iconButton active" : "iconButton"}
          type="button"
          title="列表视图"
          aria-label="列表视图"
          onClick={() => onChangeView("list")}
        >
          <List size={18} aria-hidden="true" />
        </button>
        <button
          className={view === "grid" ? "iconButton active" : "iconButton"}
          type="button"
          title="网格视图"
          aria-label="网格视图"
          onClick={() => onChangeView("grid")}
        >
          <Grid3X3 size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
