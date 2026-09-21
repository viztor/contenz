/**
 * Filesystem storage backend for the reader (Node only).
 *
 * Lives in `./api`, never in `./reader` — importing this module pulls
 * `node:fs`, which must not enter the edge bundle.
 */

import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  isSafeStoragePath,
  type FileStat,
  type Storage,
  type StorageEntry,
  type StorageStreamRange,
  type WritableStorage,
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
    async stat(filePath: string): Promise<FileStat | null> {
      if (!isSafeStoragePath(filePath)) return null;
      try {
        const st = await fs.stat(path.join(root, filePath));
        if (!st.isFile()) return null;
        return { size: st.size, mtimeMs: st.mtimeMs };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async streamFile(
      filePath: string,
      opts?: { range?: StorageStreamRange }
    ): Promise<ReadableStream<Uint8Array> | null> {
      if (!isSafeStoragePath(filePath)) return null;
      const full = path.join(root, filePath);
      try {
        await fs.access(full);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
      const range = opts?.range;
      const nodeStream = createReadStream(
        full,
        range
          ? {
              start: range.offset,
              end:
                range.length !== undefined
                  ? range.offset + range.length - 1
                  : undefined,
            }
          : {}
      );
      return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    },
  };
}

/** `fs`-backed writable storage (adds recursive mkdir + write). */
export function nodeWritableStorage(
  options: NodeStorageOptions
): WritableStorage {
  const read = nodeStorage(options);
  return {
    ...read,
    async writeFile(filePath: string, bytes: Uint8Array): Promise<void> {
      if (!isSafeStoragePath(filePath)) {
        throw new Error(`Refusing to write unsafe storage path: "${filePath}"`);
      }
      await fs.writeFile(path.join(options.root, filePath), bytes);
    },
    async mkdir(dirPath: string): Promise<void> {
      if (!isSafeStoragePath(dirPath)) {
        throw new Error(`Refusing to mkdir unsafe storage path: "${dirPath}"`);
      }
      await fs.mkdir(path.join(options.root, dirPath), { recursive: true });
    },
  };
}
