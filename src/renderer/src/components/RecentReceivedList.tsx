import type { ReactElement } from "react";
import type { FileBrowserEntry } from "../../../shared/fileBrowserTypes";

type RecentReceivedListProps = {
  entries: FileBrowserEntry[];
  emptyText: string;
  onOpenFile(relativePath: string): void;
  onShowFile(relativePath: string): void;
};

export function RecentReceivedList({ entries, emptyText, onOpenFile, onShowFile }: RecentReceivedListProps): ReactElement {
  if (entries.length === 0) {
    return (
      <div className="emptyState small">
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="recentList">
      {entries.map((entry) => (
        <div className="recentRow" key={entry.relativePath}>
          <span>{entry.name}</span>
          <div className="deviceActions">
            <button className="secondaryButton" type="button" onClick={() => onOpenFile(entry.relativePath)}>
              打开
            </button>
            <button className="secondaryButton" type="button" onClick={() => onShowFile(entry.relativePath)}>
              位置
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
