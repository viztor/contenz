/**
 * Storage backends for the reader.
 *
 * Pure module — zero `node:` imports, safe for `@contenz/core/reader` on edge
 * runtimes. `Storage` abstracts where bytes come from (memory, HTTP, fs, R2,
 * …); everything above it (parse → validate → fallback-resolve) is shared.
 * See `dev/research/spec-storage.md` for the full backend + credentials design.
 */

export interface StorageEntry {
  /** Basename within the listed directory (no slashes) */
  name: string;
  kind: "file" | "dir";
}

export interface StorageStreamRange {
  offset: number;
  length?: number;
}

export interface FileStat {
  /** Bytes, or null when the backend cannot determine size without reading. */
  size: number | null;
  mtimeMs?: number;
  etag?: string;
}

/**
 * Byte source for the reader. All paths are POSIX, relative, with no leading
 * `/` and no `.`/`..` segments. Implementations MUST return `null` (not throw)
 * for missing files and `[]` for missing/unlistable directories, and MUST
 * reject traversal (`\`, `..`, `.` segments → `null` / `[]`).
 */
export interface Storage {
  readFile(path: string): Promise<Uint8Array | null>;
  listdir(path: string): Promise<StorageEntry[]>;
  /**
   * Optional zero-copy streaming (R2 object bodies, HTTP responses).
   * Absent implementations fall back to buffering via `readFile`.
   */
  streamFile?(
    path: string,
    opts?: { range?: StorageStreamRange }
  ): Promise<ReadableStream<Uint8Array> | null>;
  /**
   * Optional metadata probe without fetching the body. Absent or null means
   * "unknown without reading" — callers must handle size-unknown files.
   */
  stat?(path: string): Promise<FileStat | null>;
}

/**
 * Write-capable storage. Reads follow `Storage` semantics; writes are
 * explicit paths (callers construct names — no slug handling here).
 */
export interface WritableStorage extends Storage {
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  /** Recursive directory creation. Absent = flat stores (KV/R2-style roots). */
  mkdir?(path: string): Promise<void>;
  /** Reserved for future delete operations. */
  remove?(path: string): Promise<void>;
}

/** Join storage-relative POSIX segments (no `node:path` — edge-safe). */
export function joinStoragePath(...parts: string[]): string {
  return parts
    .flatMap((p) => p.split("/"))
    .filter((seg) => seg.length > 0 && seg !== ".")
    .join("/");
}

/** Directory portion of a storage path ("" for bare filenames). */
export function dirnameOf(storagePath: string): string {
  const slash = storagePath.lastIndexOf("/");
  return slash === -1 ? "" : storagePath.slice(0, slash);
}

/** True when a storage path is safe to resolve (no traversal, no absolutes). */
export function isSafeStoragePath(path: string): boolean {
  if (path.length === 0) return false;
  const segments = path.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") return false;
    if (seg.includes("\\")) return false;
  }
  return true;
}

function normalizeKey(key: string): string {
  return key
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

// ── Memory ────────────────────────────────────────────────────────────────

/**
 * In-memory storage from a path → content map. Keys are storage-relative
 * POSIX paths; string values are UTF-8 encoded. Primary backend for bundled
 * edge/SSG usage and tests.
 */
export function memoryStorage(
  files: Record<string, Uint8Array | string>
): WritableStorage {
  const encoder = new TextEncoder();
  const store = new Map<string, Uint8Array>();
  for (const [key, value] of Object.entries(files)) {
    const normalized = normalizeKey(key);
    if (!isSafeStoragePath(normalized)) continue;
    store.set(
      normalized,
      typeof value === "string" ? encoder.encode(value) : value
    );
  }

  return {
    async readFile(path: string): Promise<Uint8Array | null> {
      if (!isSafeStoragePath(path)) return null;
      return store.get(normalizeKey(path)) ?? null;
    },
    async listdir(path: string): Promise<StorageEntry[]> {
      const dir = normalizeKey(path);
      if (!isSafeStoragePath(dir)) return [];
      const prefix = `${dir}/`;
      const fileNames = new Set<string>();
      const dirNames = new Set<string>();
      for (const key of store.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        if (rest.length === 0) continue;
        const slash = rest.indexOf("/");
        if (slash === -1) {
          fileNames.add(rest);
        } else {
          dirNames.add(rest.slice(0, slash));
        }
      }
      // Files shadow same-named dirs; deterministic sort (mirrors discovery).
      const entries: StorageEntry[] = [
        ...[...dirNames]
          .filter((d) => !fileNames.has(d))
          .map((name) => ({ name, kind: "dir" as const })),
        ...[...fileNames].map((name) => ({ name, kind: "file" as const })),
      ];
      entries.sort((a, b) => a.name.localeCompare(b.name));
      return entries;
    },
    async streamFile(
      path: string,
      opts?: { range?: StorageStreamRange }
    ): Promise<ReadableStream<Uint8Array> | null> {
      const bytes = await this.readFile(path);
      if (!bytes) return null;
      const sliced = sliceRange(bytes, opts?.range);
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(sliced);
          controller.close();
        },
      });
    },
    async writeFile(path: string, bytes: Uint8Array): Promise<void> {
      if (!isSafeStoragePath(path)) {
        throw new Error(`Refusing to write unsafe storage path: "${path}"`);
      }
      store.set(normalizeKey(path), bytes);
    },
    async mkdir(_path: string): Promise<void> {
      // In-memory map needs no directories.
    },
    async stat(path: string): Promise<FileStat | null> {
      if (!isSafeStoragePath(path)) return null;
      const bytes = store.get(normalizeKey(path));
      return bytes ? { size: bytes.length } : null;
    },
  };
}

// ── Fetch ─────────────────────────────────────────────────────────────────

export interface FetchStorageOptions {
  /** Base URL content is served from, e.g. "https://cdn.example.com/content" */
  baseUrl: string;
  /** Caller-supplied headers (auth). Server-side only — never ship tokens. */
  headers?: Record<string, string>;
  /** Default "force-cache" */
  cache?: RequestCache;
}

/**
 * HTTP storage: `${baseUrl}/${path}`. Universal (edge-safe).
 * 404 → `null`/`[]`; other non-2xx → throw (outages must not mimic emptiness).
 * `listdir` reads the build-emitted `${dir}/.listing.json` (string array);
 * missing listing → throw `LISTING_MISSING` naming the expected URL.
 * Direct `readFile` never needs listings (callers address files explicitly).
 */
export function fetchStorage(options: FetchStorageOptions): Storage {
  const base = options.baseUrl.replace(/\/+$/, "");
  const headers = options.headers;
  const cache = options.cache ?? "force-cache";

  async function get(url: string): Promise<Response> {
    return fetch(url, { headers, cache });
  }

  return {
    async readFile(path: string): Promise<Uint8Array | null> {
      if (!isSafeStoragePath(path)) return null;
      const res = await get(`${base}/${path}`);
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(
          `Fetch storage read failed for "${path}": ${res.status}`
        );
      }
      return new Uint8Array(await res.arrayBuffer());
    },
    async listdir(path: string): Promise<StorageEntry[]> {
      if (!isSafeStoragePath(path)) return [];
      const url = `${base}/${path}/.listing.json`;
      const res = await get(url);
      if (res.status === 404) {
        throw new Error(
          `LISTING_MISSING: no listing at "${url}". ` +
            `Emit per-directory .listing.json at build time for fetch enumeration.`
        );
      }
      if (!res.ok) {
        throw new Error(
          `Fetch storage list failed for "${path}": ${res.status}`
        );
      }
      const names = (await res.json()) as unknown;
      if (!Array.isArray(names)) return [];
      return (names as unknown[])
        .filter((n): n is string => typeof n === "string")
        .map((name) => ({ name, kind: "file" as const }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async streamFile(
      path: string,
      opts?: { range?: StorageStreamRange }
    ): Promise<ReadableStream<Uint8Array> | null> {
      if (!isSafeStoragePath(path)) return null;
      const rangeHeaders = { ...headers };
      if (opts?.range) {
        const end =
          opts.range.length !== undefined
            ? opts.range.offset + opts.range.length - 1
            : "";
        rangeHeaders.Range = `bytes=${opts.range.offset}-${end}`;
      }
      const res = await fetch(`${base}/${path}`, {
        headers: rangeHeaders,
        cache,
      });
      if (res.status === 404) return null;
      if (res.status === 416) {
        // Range beyond EOF: empty, not missing.
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        });
      }
      if (!res.ok && res.status !== 206) {
        throw new Error(
          `Fetch storage stream failed for "${path}": ${res.status}`
        );
      }
      return res.body;
    },
    async stat(path: string): Promise<FileStat | null> {
      if (!isSafeStoragePath(path)) return null;
      let res: Response;
      try {
        res = await fetch(`${base}/${path}`, {
          method: "HEAD",
          headers,
          cache,
        });
      } catch {
        return null;
      }
      if (!res.ok) return null;
      const length = res.headers.get("content-length");
      const parsed = length !== null ? Number(length) : NaN;
      const lastModified = res.headers.get("last-modified");
      const mtimeMs = lastModified ? Date.parse(lastModified) : NaN;
      const etag = res.headers.get("etag") ?? undefined;
      return {
        size: Number.isFinite(parsed) ? parsed : null,
        ...(Number.isFinite(mtimeMs) ? { mtimeMs } : {}),
        ...(etag ? { etag } : {}),
      };
    },
  };
}

// ── Tiered ────────────────────────────────────────────────────────────────

/**
 * A storage-relative file opened for reading: metadata snapshot plus
 * streaming, ranged, and decoded access. Construct via `openFile` (never
 * `new` — backends resolve capabilities there).
 *
 * Ranges are honored natively where the backend supports them (fs/R2/206)
 * and emulated by slice-after-read elsewhere; `seekable` reports which.
 * `null` from any accessor means "file missing", never "empty".
 */
export interface FileHandle {
  readonly path: string;
  readonly size: number | null;
  readonly mtimeMs?: number;
  readonly etag?: string;
  /** False when the backend can only serve ranges by buffering the whole file. */
  readonly seekable: boolean;
  stat(): Promise<FileStat | null>;
  stream(
    range?: StorageStreamRange
  ): Promise<ReadableStream<Uint8Array> | null>;
  read(range?: StorageStreamRange): Promise<Uint8Array | null>;
  text(range?: StorageStreamRange): Promise<string | null>;
  /** Parse the full body as JSON. Throws on corrupt content. */
  json<T = unknown>(): Promise<T | null>;
}

async function collectStream(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function sliceRange(
  bytes: Uint8Array,
  range: StorageStreamRange | undefined
): Uint8Array {
  if (!range) return bytes;
  return bytes.slice(
    range.offset,
    range.length !== undefined ? range.offset + range.length : undefined
  );
}

/**
 * Open a storage-relative file for reading. Returns null for unsafe paths,
 * and for missing files when the backend supports stat. Backends without
 * stat yield optimistic handles (reads resolve existence).
 */
export async function openFile(
  store: Storage,
  filePath: string
): Promise<FileHandle | null> {
  if (!isSafeStoragePath(filePath)) return null;
  const initial = store.stat ? await store.stat(filePath) : undefined;
  if (store.stat && !initial) return null;

  async function stream(
    range?: StorageStreamRange
  ): Promise<ReadableStream<Uint8Array> | null> {
    if (store.streamFile) {
      const native = await store.streamFile(
        filePath,
        range ? { range } : undefined
      );
      if (native) return native;
    }
    const bytes = await store.readFile(filePath);
    if (!bytes) return null;
    const sliced = sliceRange(bytes, range);
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sliced);
        controller.close();
      },
    });
  }

  async function read(range?: StorageStreamRange): Promise<Uint8Array | null> {
    const active = await stream(range);
    if (!active) return null;
    return collectStream(active);
  }

  const handle: FileHandle = {
    path: filePath,
    size: initial?.size ?? null,
    ...(initial?.mtimeMs !== undefined ? { mtimeMs: initial.mtimeMs } : {}),
    ...(initial?.etag ? { etag: initial.etag } : {}),
    seekable: true,
    stat: async () =>
      store.stat ? store.stat(filePath) : Promise.resolve(null),
    stream,
    read,
    async text(range?: StorageStreamRange): Promise<string | null> {
      const bytes = await read(range);
      return bytes ? new TextDecoder().decode(bytes) : null;
    },
    async json<T = unknown>(): Promise<T | null> {
      const body = await read();
      if (!body) return null;
      return JSON.parse(new TextDecoder().decode(body)) as T;
    },
  };
  return handle;
}

/**
 * Try stores in order; first non-null read wins, listings merge (deduped).
 * Enables KV→R2 tiering and preview-over-prod overlays. Writes delegate to
 * the first writable backend (throwing when every backend is read-only).
 */
export function tieredStorage(stores: Storage[]): WritableStorage {
  return {
    async readFile(path: string): Promise<Uint8Array | null> {
      for (const store of stores) {
        const bytes = await store.readFile(path);
        if (bytes) return bytes;
      }
      return null;
    },
    async listdir(path: string): Promise<StorageEntry[]> {
      const merged = new Map<string, StorageEntry>();
      for (const store of stores) {
        for (const entry of await store.listdir(path)) {
          const existing = merged.get(entry.name);
          if (!existing || existing.kind === "dir") {
            merged.set(entry.name, entry);
          }
        }
      }
      return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    async streamFile(
      path: string,
      opts?: { range?: StorageStreamRange }
    ): Promise<ReadableStream<Uint8Array> | null> {
      for (const store of stores) {
        if (!store.streamFile) continue;
        const stream = await store.streamFile(path, opts);
        if (stream) return stream;
      }
      return null;
    },
    async writeFile(path: string, bytes: Uint8Array): Promise<void> {
      for (const store of stores) {
        if ("writeFile" in store && typeof store.writeFile === "function") {
          await store.writeFile(path, bytes);
          return;
        }
      }
      throw new Error(
        `No writable storage in tier for path "${path}" (all backends read-only).`
      );
    },
    async mkdir(path: string): Promise<void> {
      for (const store of stores) {
        if ("mkdir" in store && typeof store.mkdir === "function") {
          await store.mkdir(path);
          return;
        }
      }
      // No backend needs directory creation — treat as success.
    },
    async stat(path: string): Promise<FileStat | null> {
      for (const store of stores) {
        if ("stat" in store && typeof store.stat === "function") {
          const stat = await store.stat(path);
          if (stat) return stat;
        }
      }
      return null;
    },
  };
}
