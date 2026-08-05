/**
 * Watch content and config, run build on change.
 */

import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";

import type { ContenzConfig } from "@contenz/core/api";
import {
  loadProjectConfig,
  resolveSourcePatterns,
  runBuild,
} from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { log, logError } from "../output.js";
import {
  cwdFlag,
  diagnosticFormatFlag,
  type DiagnosticFormat,
} from "../shared.js";

function resolveWatchRoots(cwd: string, sources: string[]): string[] {
  const roots: string[] = [cwd];
  for (const source of sources) {
    const base = source.endsWith("/*") ? source.slice(0, -2) : source;
    const resolved = path.resolve(cwd, base);
    if (!roots.includes(resolved)) roots.push(resolved);
  }
  return roots;
}

function isRelevantFile(relativePath: string): boolean {
  const p = relativePath.replace(/\\/g, "/");
  if (/^contenz\.config\.(ts|mjs|js)$/.test(p)) return true;
  if (p.endsWith("/schema.ts")) return true;
  if (p.endsWith("/config.ts")) return true;
  if (/\.(md|mdx)$/.test(p)) return true;
  return false;
}

interface WatchFlags {
  cwd: string;
  format: DiagnosticFormat;
}

async function watch(this: ContenzContext, flags: WatchFlags): Promise<void> {
  const cwd = path.resolve(process.cwd(), flags.cwd);
  let projectConfig: ContenzConfig = {};
  try {
    projectConfig = await loadProjectConfig(cwd);
  } catch {
    // use defaults
  }
  const sources = resolveSourcePatterns(projectConfig);
  const watchRoots = resolveWatchRoots(cwd, sources);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_MS = 200;

  const run = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void (async () => {
        const result = await runBuild({
          cwd: flags.cwd,
          format: flags.format,
        });
        log(this, result.report);
        if (!result.success) {
          logError(this, "Build had errors. Watching for further changes.");
        }
      })();
    }, DEBOUNCE_MS);
  };

  log(this, "Watching for changes... (Ctrl+C to stop)");
  run();

  const watchers: fs.FSWatcher[] = [];
  for (const root of watchRoots) {
    try {
      const w = fs.watch(root, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        const relative = path.relative(root, path.join(root, filename));
        if (isRelevantFile(relative)) run();
      });
      watchers.push(w);
    } catch (err) {
      logError(this, `Could not watch ${root}: ${String(err)}`);
    }
  }

  // Keep the process alive until SIGINT
  await once(this.process, "SIGINT");
  for (const w of watchers) w.close();
}

export const watchCommandDef = buildCommand({
  func: watch,
  parameters: {
    flags: {
      cwd: cwdFlag,
      format: diagnosticFormatFlag,
    },
  },
  docs: {
    brief: "Watch content and config, run build on change",
  },
});
