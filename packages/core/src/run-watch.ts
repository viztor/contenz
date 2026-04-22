/**
 * Programmatic watch mode for contenz.
 * Watches content and config files, triggers incremental rebuilds on change.
 *
 * Used by the CLI (`contenz watch`) and framework integrations (Next.js plugin).
 * Returns an event-emitting WatchHandle that can be stopped programmatically.
 *
 * @module
 */

import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { loadProjectConfig } from "./config.js";
import { type BuildOptions, type BuildResult, runBuild } from "./run-build.js";
import { resolveSourcePatterns } from "./sources.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface WatchOptions {
  /** Project root (where contenz.config.ts lives) */
  cwd: string;
  /** Diagnostic format for build reports */
  format?: "pretty" | "json" | "github";
  /** Debounce interval in milliseconds (default: 150) */
  debounceMs?: number;
  /** Build options forwarded to runBuild (minus cwd/format) */
  buildOptions?: Pick<BuildOptions, "sources" | "force">;
}

export interface WatchEvent {
  type: "ready" | "change" | "rebuild" | "error";
  timestamp: number;
}

export interface WatchReadyEvent extends WatchEvent {
  type: "ready";
  result: BuildResult;
}

export interface WatchChangeEvent extends WatchEvent {
  type: "change";
  /** Relative file path that triggered the rebuild */
  file: string;
}

export interface WatchRebuildEvent extends WatchEvent {
  type: "rebuild";
  result: BuildResult;
  /** Duration of the rebuild in milliseconds */
  durationMs: number;
}

export interface WatchErrorEvent extends WatchEvent {
  type: "error";
  error: Error;
}

export type WatchEventMap = {
  ready: [WatchReadyEvent];
  change: [WatchChangeEvent];
  rebuild: [WatchRebuildEvent];
  error: [WatchErrorEvent];
};

/**
 * Handle returned by `runWatch`. Use it to listen for events and stop the watcher.
 */
export interface WatchHandle {
  /** Subscribe to watch events */
  on<K extends keyof WatchEventMap>(event: K, listener: (...args: WatchEventMap[K]) => void): this;
  /** Unsubscribe from watch events */
  off<K extends keyof WatchEventMap>(event: K, listener: (...args: WatchEventMap[K]) => void): this;
  /** Stop watching and release resources */
  stop(): void;
  /** Whether the watcher is still active */
  readonly active: boolean;
}

// ── Implementation ──────────────────────────────────────────────────────────

/** File patterns that trigger a rebuild when changed */
const RELEVANT_PATTERNS = [
  /^contenz\.config\.(ts|mjs|js)$/,
  /\/schema\.ts$/,
  /\/config\.ts$/,
  /\.(md|mdx|json)$/,
];

function isRelevantFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return RELEVANT_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Compute the set of directories to watch.
 * Includes the project root (for contenz.config.ts) and all source roots.
 */
function resolveWatchRoots(cwd: string, sources: string[]): string[] {
  const roots = new Set<string>([cwd]);
  for (const source of sources) {
    const base = source.endsWith("/*") ? source.slice(0, -2) : source;
    roots.add(path.resolve(cwd, base));
  }
  return [...roots];
}

/**
 * Start watching content and config files for changes.
 * Performs an initial build immediately, then rebuilds on relevant file changes.
 *
 * @returns A WatchHandle for subscribing to events and stopping the watcher.
 *
 * @example
 * ```ts
 * import { runWatch } from "@contenz/core/api";
 *
 * const watcher = runWatch({ cwd: "." });
 *
 * watcher.on("ready", (event) => {
 *   console.log("Initial build complete:", event.result.success);
 * });
 *
 * watcher.on("rebuild", (event) => {
 *   console.log(`Rebuilt in ${event.durationMs}ms`);
 * });
 *
 * // Later: stop watching
 * watcher.stop();
 * ```
 */
export function runWatch(options: WatchOptions): WatchHandle {
  const cwd = path.resolve(process.cwd(), options.cwd ?? ".");
  const format = options.format ?? "pretty";
  const debounceMs = options.debounceMs ?? 150;

  const emitter = new EventEmitter();
  const watchers: fs.FSWatcher[] = [];
  let _active = true;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isBuilding = false;
  let pendingRebuild = false;

  const buildOpts: BuildOptions = {
    cwd: options.cwd,
    format,
    ...options.buildOptions,
  };

  async function doBuild(isInitial: boolean): Promise<void> {
    if (!_active) return;
    if (isBuilding) {
      pendingRebuild = true;
      return;
    }
    isBuilding = true;
    const start = Date.now();

    try {
      const result = await runBuild(buildOpts);
      const now = Date.now();

      if (isInitial) {
        emitter.emit("ready", {
          type: "ready",
          timestamp: now,
          result,
        } satisfies WatchReadyEvent);
      } else {
        emitter.emit("rebuild", {
          type: "rebuild",
          timestamp: now,
          result,
          durationMs: now - start,
        } satisfies WatchRebuildEvent);
      }
    } catch (err) {
      emitter.emit("error", {
        type: "error",
        timestamp: Date.now(),
        error: err instanceof Error ? err : new Error(String(err)),
      } satisfies WatchErrorEvent);
    } finally {
      isBuilding = false;
      if (pendingRebuild && _active) {
        pendingRebuild = false;
        doBuild(false);
      }
    }
  }

  function scheduleRebuild(file: string): void {
    if (!_active) return;

    emitter.emit("change", {
      type: "change",
      timestamp: Date.now(),
      file,
    } satisfies WatchChangeEvent);

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      doBuild(false);
    }, debounceMs);
  }

  // Bootstrap: load config to discover source patterns, then start watchers
  (async () => {
    try {
      let projectConfig = {};
      try {
        projectConfig = await loadProjectConfig(cwd);
      } catch {
        // Use defaults
      }
      const sources = resolveSourcePatterns(projectConfig);
      const watchRoots = resolveWatchRoots(cwd, sources);

      // Start filesystem watchers
      for (const root of watchRoots) {
        try {
          const watcher = fs.watch(root, { recursive: true }, (_eventType, filename) => {
            if (!filename || !_active) return;
            const relative = path.relative(root, path.join(root, filename));
            if (isRelevantFile(relative)) {
              scheduleRebuild(relative);
            }
          });
          watchers.push(watcher);
        } catch {
          // Directory might not exist; skip silently
        }
      }

      // Initial build
      await doBuild(true);
    } catch (err) {
      emitter.emit("error", {
        type: "error",
        timestamp: Date.now(),
        error: err instanceof Error ? err : new Error(String(err)),
      } satisfies WatchErrorEvent);
    }
  })();

  const handle: WatchHandle = {
    on(event, listener) {
      emitter.on(event, listener as (...args: unknown[]) => void);
      return handle;
    },
    off(event, listener) {
      emitter.off(event, listener as (...args: unknown[]) => void);
      return handle;
    },
    stop() {
      _active = false;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      for (const watcher of watchers) {
        watcher.close();
      }
      watchers.length = 0;
      emitter.removeAllListeners();
    },
    get active() {
      return _active;
    },
  };

  return handle;
}
