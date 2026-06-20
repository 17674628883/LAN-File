import { Upload } from "lucide-react";
import { useState, type DragEvent, type ReactElement } from "react";

type DeviceDropTargetProps = {
  deviceName: string;
  disabled: boolean;
  getPathForFile(file: File): string;
  onDropPaths(paths: string[]): void;
};

export function DeviceDropTarget({ deviceName, disabled, getPathForFile, onDropPaths }: DeviceDropTargetProps): ReactElement {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);

    if (disabled) return;

    const paths = Array.from(event.dataTransfer.files)
      .map(getPathForFile)
      .filter((filePath) => filePath.length > 0);

    if (paths.length > 0) {
      onDropPaths(paths);
    }
  };

  return (
    <div
      className={dragging ? "dropTarget active" : "dropTarget"}
      aria-disabled={disabled}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <Upload size={18} aria-hidden={true} />
      <span>{disabled ? "配对后可拖拽发送" : `拖到这里发送给 ${deviceName}`}</span>
    </div>
  );
}
