import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chooseReceivedPath } from "../../src/main/core/receivedFiles";

const tempRoots: string[] = [];

describe("received files", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })));
  });

  it("keeps both files when a received name already exists", async () => {
    const root = await createTempRoot();
    await fs.writeFile(path.join(root, "Photo.jpg"), "old");

    const result = await chooseReceivedPath(root, "Photo.jpg");

    expect(result.relativePath).toBe("Photo (1).jpg");
    expect(result.absolutePath).toBe(path.join(root, "Photo (1).jpg"));
  });

  it("chooses an available name inside nested receive directories", async () => {
    const root = await createTempRoot();
    await fs.mkdir(path.join(root, "docs"), { recursive: true });
    await fs.writeFile(path.join(root, "docs", "readme.txt"), "old");

    const result = await chooseReceivedPath(root, "docs/readme.txt");

    expect(result.relativePath).toBe("docs/readme (1).txt");
    expect(result.absolutePath).toBe(path.join(root, "docs", "readme (1).txt"));
  });

  it("rejects paths that are not safe relative receive paths", async () => {
    const root = await createTempRoot();

    await expect(chooseReceivedPath(root, "../outside.txt")).rejects.toThrow("Invalid received file path.");
    await expect(chooseReceivedPath(root, "/absolute.txt")).rejects.toThrow("Invalid received file path.");
    await expect(chooseReceivedPath(root, "docs//readme.txt")).rejects.toThrow("Invalid received file path.");
  });
});

async function createTempRoot(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lan-received-files-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}
