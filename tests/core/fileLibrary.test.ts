import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listLocalDirectory } from "../../src/main/core/fileLibrary";
import type {
  FileBrowserEntry,
  FileBrowserLocation,
  FileBrowserSource,
  FileBrowserView,
  FileKind
} from "../../src/shared/fileBrowserTypes";

const tempRoots: string[] = [];

describe("file library local directory listing", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })));
  });

  it("lists local entries with directories first and file metadata", async () => {
    const root = await createTempRoot();
    await fs.mkdir(path.join(root, "zeta"));
    await fs.mkdir(path.join(root, "alpha"));
    await fs.writeFile(path.join(root, "bravo.txt"), "bravo");
    await fs.writeFile(path.join(root, "photo.jpg"), "image");
    await fs.writeFile(path.join(root, "alpha", "charlie.md"), "charlie");

    const rootEntries = await listLocalDirectory(root);
    const nestedEntries = await listLocalDirectory(root, "alpha");

    expect(rootEntries.map(({ name, relativePath, kind }) => ({ name, relativePath, kind }))).toEqual([
      { name: "alpha", relativePath: "alpha", kind: "directory" },
      { name: "zeta", relativePath: "zeta", kind: "directory" },
      { name: "bravo.txt", relativePath: "bravo.txt", kind: "document" },
      { name: "photo.jpg", relativePath: "photo.jpg", kind: "image" }
    ]);
    expect(rootEntries.find((entry) => entry.name === "bravo.txt")).toMatchObject({
      kind: "document",
      extension: ".txt",
      size: 5,
      modifiedAt: expect.any(Number)
    });
    expect(nestedEntries).toMatchObject([
      {
        name: "charlie.md",
        relativePath: "alpha/charlie.md",
        kind: "document",
        extension: ".md",
        size: 7,
        modifiedAt: expect.any(Number)
      }
    ]);
  });

  it("rejects local directory paths that escape the shared root", async () => {
    const root = await createTempRoot();

    await expect(listLocalDirectory(root, "../outside")).rejects.toThrow("Invalid shared folder path");
  });

  it("exports shared file browser type names", () => {
    const kind: FileKind = "document";
    const view: FileBrowserView = "list";
    const source: FileBrowserSource = "received-local";
    const entry = {
      name: "readme.txt",
      relativePath: "readme.txt",
      kind,
      extension: ".txt",
      size: 6,
      modifiedAt: 0
    } satisfies FileBrowserEntry;
    const location = { source, relativePath: entry.relativePath } satisfies FileBrowserLocation;

    expect({ view, location }).toEqual({
      view: "list",
      location: { source: "received-local", relativePath: "readme.txt" }
    });
  });
});

async function createTempRoot(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lan-file-library-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}
