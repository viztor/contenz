/**
 * Programmatic status: report whether build is up to date or needs rebuild.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { loadCollectionConfig, loadProjectConfig, resolveConfig } from "./config.js";
import {
  computeCollectionInputHash,
  computeConfigHash,
  getCachedInputHash,
  loadManifest,
} from "./manifest.js";
import {
  type DiscoveredCollection,
  discoverCollections,
  globContentFiles,
  normalizeLegacyContentDir,
} from "./sources.js";

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
  const projectConfig = await loadProjectConfig(cwd);
  let baseConfig: ReturnType<typeof resolveConfig>;
  try {
    baseConfig = resolveConfig(projectConfig);
  } catch {
    return {
      status: "needs-build",
      message: "Invalid or missing config.",
      dirtyCollections: [],
      freshCollections: [],
    };
  }

  const sources =
    options.sources ??
    (options.dir ? [normalizeLegacyContentDir(options.dir)] : baseConfig.sources);
  const outputDir = path.resolve(cwd, baseConfig.outputDir);

  let collections: DiscoveredCollection[];
  try {
    const discovery = await discoverCollections(cwd, sources);
    collections = discovery.collections;
    if (discovery.errors.length > 0 || collections.length === 0) {
      return {
        status: "needs-build",
        message:
          collections.length === 0
            ? "No collections found."
            : "Discovery errors; run build for details.",
        dirtyCollections: [],
        freshCollections: [],
      };
    }
  } catch {
    return {
      status: "needs-build",
      message: "Failed to discover collections.",
      dirtyCollections: [],
      freshCollections: [],
    };
  }

  const manifest = await loadManifest(cwd);
  const projectConfigHash = computeConfigHash(baseConfig as unknown as Record<string, unknown>);
  const dirty: string[] = [];
  const fresh: string[] = [];

  for (const collection of collections) {
    const collectionConfig = await loadCollectionConfig(collection.collectionPath);
    const config = resolveConfig(projectConfig, collectionConfig);
    const contentFiles = await globContentFiles(
      collection.collectionPath,
      config.extensions,
      config.ignore
    );
    const inputHash = await computeCollectionInputHash(
      collection.collectionPath,
      contentFiles,
      config.extensions
    );

    const cachedHash = getCachedInputHash(
      manifest,
      cwd,
      baseConfig.outputDir,
      sources,
      collection.name,
      projectConfigHash
    );
    const outputPath = path.join(outputDir, `${collection.name}.ts`);
    let outputExists = false;
    try {
      await fs.access(outputPath);
      outputExists = true;
    } catch {
      // output missing
    }

    if (cachedHash === inputHash && outputExists) {
      fresh.push(collection.name);
    } else {
      dirty.push(collection.name);
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
