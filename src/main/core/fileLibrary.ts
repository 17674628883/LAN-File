import fs from "node:fs";
import path from "node:path";
import type { FileBrowserEntry, FileKind } from "../../shared/fileBrowserTypes";
import { resolveSharedRealPath } from "./pathSafety";

export async function listLocalDirectory(root: string, relativePath = ""): Promise<FileBrowserEntry[]> {
  const directoryPath = await resolveRealPathOrThrow(root, relativePath);
  const dirents = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  const entries = await Promise.all(
    dirents.map(async (dirent) => {
      const entryRelativePath = joinRelativePath(relativePath, dirent.name);
      const entryPath = await resolveRealPathOrThrow(root, entryRelativePath);
      const stats = await fs.promises.stat(entryPath);
      const extension = stats.isDirectory() ? "" : path.extname(dirent.name).toLowerCase();

      return {
        name: dirent.name,
        relativePath: entryRelativePath,
        kind: stats.isDirectory() ? "directory" : classifyExtension(extension),
        extension,
        size: stats.size,
        modifiedAt: stats.mtimeMs
      } satisfies FileBrowserEntry;
    })
  );

  return entries.sort(compareEntries);
}

async function resolveRealPathOrThrow(root: string, relativePath: string): Promise<string> {
  const result = await resolveSharedRealPath(root, relativePath);

  if (!result.ok) {
    throw new Error(`Invalid shared folder path: ${result.reason}`);
  }

  return result.path;
}

function joinRelativePath(basePath: string, name: string): string {
  return path.posix.join(toForwardSlashes(basePath), name);
}

function toForwardSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function compareEntries(left: FileBrowserEntry, right: FileBrowserEntry): number {
  if (isDirectory(left) !== isDirectory(right)) {
    return isDirectory(left) ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function isDirectory(entry: FileBrowserEntry): boolean {
  return entry.kind === "directory";
}

function classifyExtension(extension: string): FileKind {
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(extension)) return "image";
  if ([".mp4", ".mov", ".mkv", ".webm"].includes(extension)) return "video";
  if ([".mp3", ".wav", ".flac", ".m4a"].includes(extension)) return "audio";
  if ([".zip", ".7z", ".rar", ".tar", ".gz"].includes(extension)) return "archive";
  if ([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md"].includes(extension)) {
    return "document";
  }
  return "other";
}
