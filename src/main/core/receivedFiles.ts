import fs from "node:fs/promises";
import path from "node:path";
import { chooseAvailableName } from "./fileNaming";

export async function chooseReceivedPath(
  root: string,
  relativePath: string
): Promise<{ absolutePath: string; relativePath: string }> {
  const normalizedRelativePath = relativePath.replace(/\\/g, "/");
  assertSafeReceivedRelativePath(normalizedRelativePath);
  const relativeDirectory = path.posix.dirname(normalizedRelativePath);
  const directory = relativeDirectory === "." ? root : path.join(root, ...relativeDirectory.split("/"));
  await fs.mkdir(directory, { recursive: true });

  const existingNames = new Set(await fs.readdir(directory));
  const availableName = chooseAvailableName(path.posix.basename(normalizedRelativePath), existingNames);
  const safeRelativePath = relativeDirectory === "." ? availableName : path.posix.join(relativeDirectory, availableName);

  return {
    absolutePath: path.join(directory, availableName),
    relativePath: safeRelativePath
  };
}

function assertSafeReceivedRelativePath(relativePath: string): void {
  if (relativePath.includes("\0") || path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new Error("Invalid received file path.");
  }

  const segments = relativePath.split("/");

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "" || segment === "." || segment === ".." || /^[a-zA-Z]:$/.test(segment))
  ) {
    throw new Error("Invalid received file path.");
  }
}
