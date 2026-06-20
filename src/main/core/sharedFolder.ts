import type { FileBrowserEntry } from "../../shared/fileBrowserTypes";
import { listLocalDirectory } from "./fileLibrary";

export type SharedFolderEntry = FileBrowserEntry;

export async function listSharedFolder(root: string, relativePath = ""): Promise<SharedFolderEntry[]> {
  try {
    return await listLocalDirectory(root, relativePath);
  } catch (error: unknown) {
    if (isSharedFolderPathError(error)) {
      throw error;
    }

    console.error("Unable to list shared folder.", error);
    throw new Error("Unable to list shared folder.");
  }
}

function isSharedFolderPathError(error: unknown): error is SharedFolderPathError {
  return error instanceof Error && error.message.startsWith("Invalid shared folder path");
}

type SharedFolderPathError = Error;
