import { describe, expect, it } from "vitest";
import type { FileBrowserEntry, FileBrowserLocation } from "../../src/shared/fileBrowserTypes";
import type { LanTransferApi } from "../../src/renderer/src/api";

describe("file library IPC contract", () => {
  it("exposes browse and file actions to the renderer", () => {
    const location = {
      source: "received-local",
      relativePath: ""
    } satisfies FileBrowserLocation;
    const entry = {
      name: "Photo.jpg",
      relativePath: "Photo.jpg",
      kind: "image",
      extension: ".jpg",
      size: 10,
      modifiedAt: 1
    } satisfies FileBrowserEntry;
    const keys: Array<keyof LanTransferApi> = [
      "listFiles",
      "openLocalFile",
      "showLocalFile",
      "deleteReceivedFile",
      "downloadPeerFile",
      "getPathForDroppedFile"
    ];

    expect(location.source).toBe("received-local");
    expect(entry.kind).toBe("image");
    expect(keys).toHaveLength(6);
  });
});
