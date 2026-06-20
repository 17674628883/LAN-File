export type FileKind = "directory" | "image" | "video" | "audio" | "archive" | "document" | "other";

export type FileBrowserView = "list" | "grid";

export type FileBrowserSource = "shared-local" | "received-local" | "peer-shared";

export interface FileBrowserEntry {
  name: string;
  relativePath: string;
  kind: FileKind;
  extension: string;
  size: number;
  modifiedAt: number;
  previewUrl?: string;
}

export interface FileBrowserLocation {
  source: FileBrowserSource;
  relativePath: string;
  peerDeviceId?: string;
}
