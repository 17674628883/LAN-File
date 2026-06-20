import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listSharedFolder } from "../../src/main/core/sharedFolder";

const tempRoots: string[] = [];

describe("shared folder listing", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })));
  });

  it("lists entries with directories first and forward-slash relative paths", async () => {
    const root = await createTempRoot();
    await fs.mkdir(path.join(root, "zeta"));
    await fs.mkdir(path.join(root, "alpha"));
    await fs.writeFile(path.join(root, "bravo.txt"), "bravo");
    await fs.writeFile(path.join(root, "alpha", "charlie.txt"), "charlie");

    const rootEntries = await listSharedFolder(root);
    const nestedEntries = await listSharedFolder(root, "alpha");

    expect(rootEntries.map(({ name, kind, relativePath }) => ({ name, kind, relativePath }))).toEqual([
      { name: "alpha", kind: "directory", relativePath: "alpha" },
      { name: "zeta", kind: "directory", relativePath: "zeta" },
      { name: "bravo.txt", kind: "document", relativePath: "bravo.txt" }
    ]);
    expect(nestedEntries).toMatchObject([
      {
        name: "charlie.txt",
        relativePath: "alpha/charlie.txt",
        kind: "document",
        extension: ".txt",
        size: 7
      }
    ]);
  });

  it("rejects paths that escape the shared root", async () => {
    const root = await createTempRoot();

    await expect(listSharedFolder(root, "../outside")).rejects.toThrow("Invalid shared folder path");
  });

  it("does not expose local paths when listing fails", async () => {
    const root = await createTempRoot();
    await fs.rm(root, { recursive: true, force: true });
    let error: unknown;

    try {
      await listSharedFolder(root);
    } catch (caughtError: unknown) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Unable to list shared folder.");
    expect((error as Error).message).not.toContain(root);
  });
});

async function createTempRoot(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lan-shared-folder-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}
