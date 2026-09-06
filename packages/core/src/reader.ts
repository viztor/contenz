/**
 * Edge-safe content reader: `createReader(config, storage)`.
 *
 * Pure module — zero `node:` imports (shares code with the CLI pipeline but
 * never touches the filesystem; bytes arrive via `Storage`). Usable on
 * Cloudflare Workers, Vercel Edge, browsers, and Node alike.
 *
 * Layering (mirrors the rest of the system):
 * - `read()` applies locale fallback chains (consumption semantics, like the
 *   generated output + `_locale.ts` resolver). Opt out with `{ fallback: false }`.
 * - Authoring/inspection ops (`runView`, …) stay exact-match in `./api`.
 */

import pMap from "p-map";
import type { ZodSchema } from "zod";

import {
  buildAdapterList,
  type FormatAdapter,
  getAdapterForExtension,
} from "./format-adapter.js";
import { getFallbackChain, normalizeI18nConfig } from "./i18n.js";
import { parseFileName } from "./parse-content.js";
import { joinStoragePath, type Storage } from "./storage.js";
import type { I18nConfigShape } from "./types.js";
import { validateMeta } from "./validator.js";

const DEFAULT_EXTENSIONS = ["md", "mdx", "json"];
const DEFAULT_IGNORE = ["README.md", "_*"];
const READ_CONCURRENCY = 8;

export interface ReaderCollectionConfig {
  /** Collection name (addressing key) */
  name: string;
  /** Storage-relative POSIX directory, e.g. "content/faq" */
  dir: string;
  /** Zod schema for meta validation (optional; unvalidated when omitted) */
  schema?: ZodSchema;
  /** Validate meta on read. Default true when `schema` is present. */
  validate?: boolean;
  /** Allowed content extensions. Default ["md", "mdx", "json"]. */
  extensions?: string[];
  /** Ignore patterns (basename, `*`/`?` wildcards). Default ["README.md", "_*"]. */
  ignore?: string[];
  /** Custom filename pattern (overrides the slug/locale convention) */
  slugPattern?: RegExp;
}

export interface ReaderSingleConfig {
  /** Single name (addressing key; acts as the slug) */
  name: string;
  /**
   * Storage-relative POSIX path of the canonical file, e.g. "data/site.yml"
   * (non-i18n) or "data/site.en.yml" (i18n default-locale file). Locale
   * variants are derived by inserting the locale before the extension.
   */
  path: string;
  /** Zod schema for meta validation (optional; unvalidated when omitted) */
  schema?: ZodSchema;
  /** Validate meta on read. Default true when `schema` is present. */
  validate?: boolean;
  /** Allowed content extensions. Default ["md", "mdx", "json"]. */
  extensions?: string[];
}

/** Enumeration fast-path (e.g. from the build `manifest.json`). */
export interface ReaderManifest {
  collections: Record<string, { slugs: string[] }>;
}

export interface ReaderOptions {
  collections: ReaderCollectionConfig[];
  /** Singles (key-addressed values, no listing) */
  singles?: ReaderSingleConfig[];
  /** Boolean or rich i18n shape (same as project config) */
  i18n?: boolean | I18nConfigShape;
  /** Format adapters (MDX etc.). JSON is always registered. */
  adapters?: FormatAdapter[];
  /**
   * Optional manifest for enumeration: `list()` serves slugs without I/O.
   * Reads still probe storage directly (freshness over staleness).
   */
  manifest?: ReaderManifest;
}

export interface ReaderEntry {
  slug: string;
  /** Null for non-i18n collections */
  locale: string | null;
  /** Storage-relative POSIX path of the source file */
  file: string;
  meta: Record<string, unknown>;
  body?: string;
  /** Set on fallback hits when `includeFallbackMetadata` is enabled */
  _fallback?: string;
}

export interface ReaderReadOptions {
  /** Locale to read (defaults to the configured default locale) */
  locale?: string;
  /** Walk fallback chains on miss. Default true (i18n mode only). */
  fallback?: boolean;
}

export interface CollectionReader {
  /** All slugs (sorted, deduplicated across locales; manifest-backed when provided) */
  list(): Promise<string[]>;
  read(
    slug: string,
    localeOrOpts?: string | ReaderReadOptions
  ): Promise<ReaderEntry | null>;
  readOrThrow(
    slug: string,
    localeOrOpts?: string | ReaderReadOptions
  ): Promise<ReaderEntry>;
  /** Every entry for a locale (default locale when omitted) */
  all(
    localeOrOpts?: string | (ReaderReadOptions & { limit?: number })
  ): Promise<ReaderEntry[]>;
}

export interface SingleReader {
  /** Read the single (default locale when omitted) */
  read(localeOrOpts?: string | ReaderReadOptions): Promise<ReaderEntry | null>;
  readOrThrow(localeOrOpts?: string | ReaderReadOptions): Promise<ReaderEntry>;
}

export interface Reader {
  collections: Record<string, CollectionReader>;
  singles: Record<string, SingleReader>;
}

function normalizeReadArgs(localeOrOpts?: string | ReaderReadOptions): {
  locale?: string;
  fallback: boolean;
} {
  if (typeof localeOrOpts === "string") {
    return { locale: localeOrOpts, fallback: true };
  }
  return {
    locale: localeOrOpts?.locale,
    fallback: localeOrOpts?.fallback ?? true,
  };
}

/** Minimal glob subset for ignore patterns: `*` (any run) and `?` (one char). */
function matchIgnore(basename: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(
      `^${pattern
        .split("")
        .map((ch) =>
          ch === "*"
            ? ".*"
            : ch === "?"
              ? "."
              : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        )
        .join("")}$`
    );
    if (regex.test(basename)) return true;
  }
  return false;
}

function isUnsafeSlug(slug: string): boolean {
  return (
    slug.length === 0 ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.split(".").includes("..")
  );
}

function failFast<T extends object>(
  api: Record<string, T>,
  kind: "Collection" | "Single"
): Record<string, T> {
  // Fail fast on misspelled names (plain records would yield `undefined`,
  // surfacing later as a confusing TypeError at the call site).
  // `then`/`toJSON`/symbols pass through so awaiting or serializing works.
  return new Proxy(api, {
    get(target, prop, receiver) {
      if (typeof prop === "symbol" || prop === "then" || prop === "toJSON") {
        return Reflect.get(target, prop, receiver);
      }
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      throw new Error(`${kind} not found: ${String(prop)}`);
    },
  });
}

export function createReader(options: ReaderOptions, storage: Storage): Reader {
  const i18n = normalizeI18nConfig(options.i18n);
  const adapters = buildAdapterList(options.adapters ?? []);
  const collections = new Map<string, ReaderCollectionConfig>();
  for (const collection of options.collections) {
    collections.set(collection.name, collection);
  }
  const singles = new Map<string, ReaderSingleConfig>();
  for (const single of options.singles ?? []) {
    singles.set(single.name, single);
  }
  const manifest = options.manifest;

  function getCollection(name: string): ReaderCollectionConfig {
    const collection = collections.get(name);
    if (!collection) {
      throw new Error(`Collection not found: ${name}`);
    }
    return collection;
  }

  function getSingle(name: string): ReaderSingleConfig {
    const single = singles.get(name);
    if (!single) {
      throw new Error(`Single not found: ${name}`);
    }
    return single;
  }

  function extensionsFor(collection: ReaderCollectionConfig): string[] {
    return collection.extensions?.length
      ? collection.extensions
      : DEFAULT_EXTENSIONS;
  }

  function ignoreFor(collection: ReaderCollectionConfig): string[] {
    return collection.ignore ?? DEFAULT_IGNORE;
  }

  async function readAndParse(
    collection: ReaderCollectionConfig,
    fileName: string,
    ext: string,
    slug: string,
    locale: string | null
  ): Promise<ReaderEntry | null> {
    return readFileEntry(
      collection,
      fileName,
      ext,
      slug,
      locale,
      adapters,
      storage
    );
  }

  function collectionReader(name: string): CollectionReader {
    const collection = getCollection(name);

    async function list(): Promise<string[]> {
      // Manifest fast-path: enumeration without I/O.
      const manifested = manifest?.collections[name]?.slugs;
      if (manifested) {
        return [...manifested].sort((a, b) => a.localeCompare(b));
      }
      const entries = await storage.listdir(collection.dir);
      const ignore = ignoreFor(collection);
      const extensions = extensionsFor(collection);
      const slugs = new Set<string>();
      for (const entry of entries) {
        if (entry.kind !== "file") continue;
        if (matchIgnore(entry.name, ignore)) continue;
        const parsed = parseFileName(
          entry.name,
          i18n.enabled,
          collection.slugPattern,
          extensions
        );
        if (!parsed) continue;
        slugs.add(parsed.slug);
      }
      return [...slugs].sort((a, b) => a.localeCompare(b));
    }

    async function read(
      slug: string,
      localeOrOpts?: string | ReaderReadOptions
    ): Promise<ReaderEntry | null> {
      if (isUnsafeSlug(slug)) return null;
      const { locale, fallback } = normalizeReadArgs(localeOrOpts);
      const extensions = extensionsFor(collection);

      if (!i18n.enabled) {
        // Locale is ignored without i18n (mirrors findContentFile).
        // First matching extension wins (build rejects such ambiguity outright).
        for (const ext of extensions) {
          const entry = await readAndParse(
            collection,
            `${slug}.${ext}`,
            ext,
            slug,
            null
          );
          if (entry) return entry;
        }
        return null;
      }

      const want = locale ?? i18n.defaultLocale;
      if (!want) return null;
      const chain = fallback ? getFallbackChain(want, i18n) : [want];
      for (const candidateLocale of chain) {
        for (const ext of extensions) {
          const entry = await readAndParse(
            collection,
            `${slug}.${candidateLocale}.${ext}`,
            ext,
            slug,
            candidateLocale
          );
          if (entry) {
            if (candidateLocale !== want && i18n.includeFallbackMetadata) {
              entry._fallback = candidateLocale;
            }
            return entry;
          }
        }
      }
      return null;
    }

    async function readOrThrow(
      slug: string,
      localeOrOpts?: string | ReaderReadOptions
    ): Promise<ReaderEntry> {
      const entry = await read(slug, localeOrOpts);
      if (!entry) {
        throw new Error(`Entry "${slug}" not found in collection "${name}"`);
      }
      return entry;
    }

    async function all(
      localeOrOpts?: string | (ReaderReadOptions & { limit?: number })
    ): Promise<ReaderEntry[]> {
      const limit =
        typeof localeOrOpts === "object" && localeOrOpts.limit !== undefined
          ? localeOrOpts.limit
          : undefined;
      const slugs = await list();
      const wanted = limit !== undefined ? slugs.slice(0, limit) : slugs;
      const found = await pMap(
        wanted,
        async (slug) => read(slug, localeOrOpts),
        {
          concurrency: READ_CONCURRENCY,
        }
      );
      return found.filter((e): e is ReaderEntry => e !== null);
    }

    return { list, read, readOrThrow, all };
  }

  function singleReader(name: string): SingleReader {
    const single = getSingle(name);
    const extensions = single.extensions?.length
      ? single.extensions
      : DEFAULT_EXTENSIONS;

    async function read(
      localeOrOpts?: string | ReaderReadOptions
    ): Promise<ReaderEntry | null> {
      const { locale, fallback } = normalizeReadArgs(localeOrOpts);
      if (!i18n.enabled) {
        // Locale is ignored without i18n; the canonical file is the value.
        return parseSingleFile(single, single.path, name, null);
      }
      // Derive stem/ext from the canonical filename (locale-aware); the
      // canonical itself is hit naturally when the chain reaches its locale.
      const slash = single.path.lastIndexOf("/");
      const base = slash === -1 ? single.path : single.path.slice(slash + 1);
      const dir = slash === -1 ? "" : single.path.slice(0, slash);
      const parsed = parseFileName(base, true, undefined, extensions);
      if (!parsed || parsed.slug !== name) return null;
      const want = locale ?? i18n.defaultLocale;
      if (!want) return null;
      const chain = fallback ? getFallbackChain(want, i18n) : [want];
      for (const candidateLocale of chain) {
        const baseName = `${parsed.slug}.${candidateLocale}.${parsed.ext}`;
        const fileName = dir ? `${dir}/${baseName}` : baseName;
        const entry = await parseSingleFile(
          single,
          fileName,
          name,
          candidateLocale
        );
        if (entry) {
          if (candidateLocale !== want && i18n.includeFallbackMetadata) {
            entry._fallback = candidateLocale;
          }
          return entry;
        }
      }
      return null;
    }

    async function readOrThrow(
      localeOrOpts?: string | ReaderReadOptions
    ): Promise<ReaderEntry> {
      const entry = await read(localeOrOpts);
      if (!entry) {
        throw new Error(
          `Single "${name}" has no content for the requested locale.`
        );
      }
      return entry;
    }

    return { read, readOrThrow };
  }

  async function parseSingleFile(
    single: ReaderSingleConfig,
    file: string,
    slug: string,
    locale: string | null
  ): Promise<ReaderEntry | null> {
    const bytes = await storage.readFile(file);
    if (!bytes) return null;
    const dot = file.lastIndexOf(".");
    const ext = dot === -1 ? "" : file.slice(dot + 1);
    return parseEntryBytes({
      file,
      ext,
      slug,
      locale,
      schema: single.schema,
      validate: single.validate,
      adapters,
      bytes,
    });
  }

  const collectionsApi: Record<string, CollectionReader> = {};
  for (const name of collections.keys()) {
    collectionsApi[name] = collectionReader(name);
  }
  const singlesApi: Record<string, SingleReader> = {};
  for (const name of singles.keys()) {
    singlesApi[name] = singleReader(name);
  }
  return {
    collections: failFast(collectionsApi, "Collection"),
    singles: failFast(singlesApi, "Single"),
  };
}

async function parseEntryBytes(args: {
  file: string;
  ext: string;
  slug: string;
  locale: string | null;
  schema?: ZodSchema;
  validate?: boolean;
  adapters: FormatAdapter[];
  bytes: Uint8Array;
}): Promise<ReaderEntry> {
  const { file, ext, slug, locale, schema, validate, adapters, bytes } = args;
  const adapter = getAdapterForExtension(ext, adapters);
  if (!adapter) {
    throw new Error(`No format adapter registered for extension: .${ext}`);
  }

  const source = new TextDecoder().decode(bytes);
  // NOTE: filenames here are constructed (not discovered), so a custom
  // slugPattern that rejects them must not fail the read — the slug is known
  // from the address. Patterns govern discovery (list), not addressed reads.
  const { meta, body } = adapter.extract(source, file);

  if (schema && validate !== false) {
    const result = validateMeta(meta ?? {}, schema, file);
    if (!result.valid) {
      const shown = result.errors
        .slice(0, 3)
        .map((e) => `${e.field}: ${e.message}`)
        .join("; ");
      const more =
        result.errors.length > 3 ? ` (+${result.errors.length - 3} more)` : "";
      throw new Error(`Invalid meta in "${file}": ${shown}${more}`);
    }
  }

  return {
    slug,
    locale,
    file,
    meta: meta ?? {},
    body,
  };
}

async function readFileEntry(
  collection: ReaderCollectionConfig,
  fileName: string,
  ext: string,
  slug: string,
  locale: string | null,
  adapters: FormatAdapter[],
  storage: Storage
): Promise<ReaderEntry | null> {
  const file = joinStoragePath(collection.dir, fileName);
  const bytes = await storage.readFile(file);
  if (!bytes) return null;

  return parseEntryBytes({
    file,
    ext,
    slug,
    locale,
    schema: collection.schema,
    validate: collection.validate,
    adapters,
    bytes,
  });
}
