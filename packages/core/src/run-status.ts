/**
 * Programmatic status: report whether build is up to date or needs rebuild.
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  computeCollectionInputHash,
  computeConfigHash,
  getCachedInputHash,
  loadManifest,
} from "./manifest.js";
import { createWorkspace } from "./workspace.js";

export interface StatusResult {
  /** "up-to-date" if manifest matches current inputs and outputs exist; "needs-build" otherwise */
  status: "up-to-date" | "needs-build";
  /** Human-readable summary */
  message: string;
  /** Collections that would be rebuilt (dirty or missing) */
  dirtyCollections: string[];
  /** Collections that are cached and would be skipped */
  freshCollections: string[];
}

export interface StatusOptions {
  cwd: string;
  sources?: string[];
  /** @deprecated Use `sources` instead. */
  dir?: string;
}

/**
 * Report whether the last build output is still valid for the current inputs.
 */
export async function runStatus(options: StatusOptions): Promise<StatusResult> {
  const cwd = path.resolve(process.cwd(), options.cwd ?? ".");

  let ws: Awaited<ReturnType<typeof createWorkspace>>;
  try {
    ws = await createWorkspace({ cwd, sources: options.sources, dir: options.dir });
  } catch {
    return {
      status: "needs-build",
      message: "Invalid or missing config.",
      dirtyCollections: [],
      freshCollections: [],
    };
  }

  if (ws.discoveryErrors.length > 0 || ws.collections.length === 0) {
    return {
      status: "needs-build",
      message:
        ws.collections.length === 0
          ? "No collections found."
          : "Discovery errors; run build for details.",
      dirtyCollections: [],
      freshCollections: [],
    };
  }

  const outputDir = path.resolve(cwd, ws.resolvedConfig.outputDir);
  const manifest = await loadManifest(cwd);
  const projectConfigHash = computeConfigHash(
    ws.resolvedConfig as unknown as Record<string, unknown>
  );
  const dirty: string[] = [];
  const fresh: string[] = [];

  for (const col of ws.collections) {
    const inputHash = await computeCollectionInputHash(
      col.collectionPath,
      col.contentFiles,
      col.config.extensions
    );

    const cachedHash = getCachedInputHash(
      manifest,
      cwd,
      ws.resolvedConfig.outputDir,
      ws.sources,
      col.name,
      projectConfigHash
    );
    const outputPath = path.join(outputDir, `${col.name}.ts`);
    let outputExists = false;
    try {
      await fs.access(outputPath);
      outputExists = true;
    } catch {
      // output missing
    }

    if (cachedHash === inputHash && outputExists) {
      fresh.push(col.name);
    } else {
      dirty.push(col.name);
    }
  }

  const status = dirty.length === 0 ? "up-to-date" : "needs-build";
  const message =
    status === "up-to-date"
      ? "Build is up to date."
      : `${dirty.length} collection(s) need rebuild.`;

  return {
    status,
    message,
    dirtyCollections: dirty,
    freshCollections: fresh,
  };
}
