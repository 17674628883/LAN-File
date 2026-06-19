import fs from "node:fs";
import path from "node:path";
import { resolveSharedRealPath } from "./pathSafety";

export interface SharedFolderEntry {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  size: number;
}

export async function listSharedFolder(root: string, relativePath = ""): Promise<SharedFolderEntry[]> {
  try {
    const directoryPath = await resolveRealPathOrThrow(root, relativePath);
    const dirents = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    const entries = await Promise.all(
      dirents.map(async (dirent) => {
        const entryRelativePath = joinRelativePath(relativePath, dirent.name);
        const entryPath = await resolveRealPathOrThrow(root, entryRelativePath);
        const stats = await fs.promises.stat(entryPath);

        return {
          name: dirent.name,
          relativePath: entryRelativePath,
          type: stats.isDirectory() ? "directory" : "file",
          size: stats.size
        } satisfies SharedFolderEntry;
      })
    );

    return entries.sort(compareEntries);
  } catch (error: unknown) {
    if (isSharedFolderPathError(error)) {
      throw error;
    }

    console.error("Unable to list shared folder.", error);
    throw new Error("Unable to list shared folder.");
  }
}

async function resolveRealPathOrThrow(root: string, relativePath: string): Promise<string> {
  const result = await resolveSharedRealPath(root, relativePath);

  if (!result.ok) {
    throw new SharedFolderPathError(`Invalid shared folder path: ${result.reason}`);
  }

  return result.path;
}

class SharedFolderPathError extends Error {}

function isSharedFolderPathError(error: unknown): error is SharedFolderPathError {
  return error instanceof SharedFolderPathError;
}

function joinRelativePath(basePath: string, name: string): string {
  return path.posix.join(toForwardSlashes(basePath), name);
}

function toForwardSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function compareEntries(left: SharedFolderEntry, right: SharedFolderEntry): number {
  if (left.type !== right.type) {
    return left.type === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}
