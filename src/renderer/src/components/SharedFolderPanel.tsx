import type { ReactElement } from "react";

type SharedFolderPanelProps = {
  sharedFolder?: string;
  onChooseFolder: () => void;
};

export function SharedFolderPanel({ sharedFolder, onChooseFolder }: SharedFolderPanelProps): ReactElement {
  return (
    <section className="panel" aria-labelledby="shared-folder-title">
      <header className="panelHeader">
        <h2 id="shared-folder-title">共享文件夹</h2>
      </header>

      <div className="folderPanel">
        <div>
          <span className="fieldLabel">当前文件夹</span>
          <p className="folderPath">{sharedFolder ?? "尚未选择共享文件夹。"}</p>
        </div>
        <button className="primaryButton" type="button" onClick={onChooseFolder}>
          选择文件夹
        </button>
      </div>
    </section>
  );
}
