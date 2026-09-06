/**
 * Filesystem storage backend for the reader (Node only).
 *
 * Lives in `./api`, never in `./reader` — importing this module pulls
 * `node:fs`, which must not enter the edge bundle.
 */

import fs from "node:fs/promises";
import path from "node:path";

import {
  isSafeStoragePath,
  type Storage,
  type StorageEntry,
} from "./storage.js";

export interface NodeStorageOptions {
  /** Project root all storage-relative paths resolve under */
  root: string;
}

/** `fs`-backed storage. ENOENT → `null`/`[]`; other errors rethrow. */
export function nodeStorage(options: NodeStorageOptions): Storage {
  const root = options.root;

  return {
    async readFile(filePath: string): Promise<Uint8Array | null> {
      if (!isSafeStoragePath(filePath)) return null;
      try {
        const data = await fs.readFile(path.join(root, filePath));
        return new Uint8Array(
          data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        );
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async listdir(dirPath: string): Promise<StorageEntry[]> {
      if (!isSafeStoragePath(dirPath)) return [];
      let dirents;
      try {
        dirents = await fs.readdir(path.join(root, dirPath), {
          withFileTypes: true,
        });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw err;
      }
      const entries: StorageEntry[] = [];
      for (const dirent of dirents) {
        if (dirent.isDirectory()) {
          entries.push({ name: dirent.name, kind: "dir" });
        } else if (dirent.isFile()) {
          entries.push({ name: dirent.name, kind: "file" });
        }
      }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      return entries;
    },
  };
}
