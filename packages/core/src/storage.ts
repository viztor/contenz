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
}

/** Join storage-relative POSIX segments (no `node:path` — edge-safe). */
export function joinStoragePath(...parts: string[]): string {
  return parts
    .flatMap((p) => p.split("/"))
    .filter((seg) => seg.length > 0 && seg !== ".")
    .join("/");
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
): Storage {
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
    async streamFile(path: string): Promise<ReadableStream<Uint8Array> | null> {
      const bytes = await this.readFile(path);
      if (!bytes) return null;
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
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
      if (!res.ok && res.status !== 206) {
        throw new Error(
          `Fetch storage stream failed for "${path}": ${res.status}`
        );
      }
      return res.body;
    },
  };
}

// ── Tiered ────────────────────────────────────────────────────────────────

/**
 * Try stores in order; first non-null read wins, listings merge (deduped).
 * Enables KV→R2 tiering and preview-over-prod overlays.
 */
export function tieredStorage(stores: Storage[]): Storage {
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
  };
}
