/**
 * Edge-safe content writer: `createWriter(options, store)`.
 *
 * Pure module — zero `node:` imports. Symmetric to `createReader`: the same
 * options shape, the same validation code path, the same filename conventions.
 * Every write is a plan first (`planCreate`/`planUpdate` return inspectable
 * bytes + validity); `apply` performs the only I/O, through `WritableStorage`.
 *
 * Layering (mirrors the reader):
 * - Reads go through an internal `createReader` (no duplicated lookup logic),
 *   built with validation disabled — existing files may be invalid; only the
 *   merged/new state is validated.
 * - Updates always target the exact locale file (`fallback: false`): editing
 *   through a fallback hit would corrupt the wrong locale.
 * - Misuse throws (unknown collection, single-create, unsafe slug, missing
 *   file); data problems yield `valid: false` + diagnostics (never throw), so
 *   agents and UIs can display them.
 */

import type { ZodSchema } from "zod";

import {
  buildAdapterList,
  type FormatAdapter,
  getAdapterForExtension,
} from "./format-adapter.js";
import { ensureResolvedI18nConfig, type ResolvedI18nConfig } from "./i18n.js";
import { introspectSchema } from "./introspect.js";
import { parseFileName } from "./parse-content.js";
import {
  createReader,
  DEFAULT_READER_EXTENSIONS,
  DEFAULT_READER_IGNORE,
  matchIgnore,
  parseEntryBytes,
  type Reader,
  type ReaderCollectionConfig,
  type ReaderEntry,
  type ReaderSingleConfig,
} from "./reader.js";
import { dirnameOf, joinStoragePath, type WritableStorage } from "./storage.js";
import type { I18nConfigShape } from "./types.js";
import { validateMeta } from "./validator.js";

export interface WriterOptions {
  collections: ReaderCollectionConfig[];
  singles?: ReaderSingleConfig[];
  /**
   * Boolean, rich shape, or an already-resolved config (content-io passes
   * `ResolvedConfig.resolvedI18n` straight through — no re-normalization).
   */
  i18n?: boolean | I18nConfigShape | ResolvedI18nConfig;
  /** Format adapters (MDX etc.). JSON is always registered. */
  adapters?: FormatAdapter[];
}

export interface PlanDiagnostic {
  field?: string;
  message: string;
}

export interface WritePlan {
  kind: "create" | "update";
  collection: string;
  slug: string;
  locale: string | null;
  /** Storage-relative POSIX path */
  file: string;
  ext: string;
  /** Previous bytes (`null` when creating) */
  before: Uint8Array | null;
  /** New serialized bytes */
  after: Uint8Array;
  /** New meta (defaults filled on create, mutations applied on update) */
  meta: Record<string, unknown>;
  body?: string;
  valid: boolean;
  diagnostics: PlanDiagnostic[];
  /** File already present (overwrite risk flag on create) */
  exists: boolean;
}

export interface PlanCreateOptions {
  locale?: string;
  ext?: string;
  body?: string;
  meta: Record<string, unknown>;
  /** Fill schema defaults into meta (default true; content-io disables it). */
  fillDefaults?: boolean;
}

export interface PlanUpdateMutations {
  set?: Record<string, unknown>;
  unset?: string[];
}

export interface WriteReceipt {
  slug: string;
  collection: string;
  /** Storage-relative POSIX path */
  file: string;
  meta: Record<string, unknown>;
  locale: string | null;
}

/** Thrown by conveniences/`apply` on invalid plans (carries diagnostics). */
export class ValidationFailedError extends Error {
  diagnostics: PlanDiagnostic[];
  constructor(diagnostics: PlanDiagnostic[] = []) {
    super("Validation failed");
    this.name = "ValidationFailedError";
    this.diagnostics = diagnostics;
  }
}

export interface Writer {
  planCreate(
    collection: string,
    slug: string,
    meta: Record<string, unknown>,
    opts?: Omit<PlanCreateOptions, "meta">
  ): Promise<WritePlan>;
  planUpdate(
    collection: string,
    slug: string | undefined,
    mutations: PlanUpdateMutations,
    locale?: string
  ): Promise<WritePlan>;
  apply(plan: WritePlan): Promise<WriteReceipt>;
  create(
    collection: string,
    slug: string,
    meta: Record<string, unknown>,
    opts?: Omit<PlanCreateOptions, "meta">
  ): Promise<WriteReceipt>;
  update(
    collection: string,
    slug: string | undefined,
    mutations: PlanUpdateMutations,
    locale?: string
  ): Promise<WriteReceipt>;
}

function isUnsafeSlug(slug: string): boolean {
  return (
    slug.length === 0 ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.split(".").includes("..")
  );
}

function toDiagnostics(
  errors: Array<{ field?: string; message: string }>
): PlanDiagnostic[] {
  return errors.map((e) => ({ field: e.field, message: e.message }));
}

function extensionsFor(collection: ReaderCollectionConfig): string[] {
  return collection.extensions?.length
    ? collection.extensions
    : DEFAULT_READER_EXTENSIONS;
}

function ignoreFor(collection: ReaderCollectionConfig): string[] {
  return collection.ignore ?? DEFAULT_READER_IGNORE;
}

export function createWriter(
  options: WriterOptions,
  store: WritableStorage
): Writer {
  const i18n = ensureResolvedI18nConfig(options.i18n);
  const adapters = buildAdapterList(options.adapters ?? []);
  const encode = new TextEncoder();

  const collections = new Map<string, ReaderCollectionConfig>();
  for (const collection of options.collections) {
    collections.set(collection.name, collection);
  }
  const singles = new Map<string, ReaderSingleConfig>();
  for (const single of options.singles ?? []) {
    singles.set(single.name, single);
  }

  // Internal reader with validation disabled: existing files may be invalid;
  // only merged/new states are validated explicitly below. Raw i18n input is
  // passed through so normalization happens exactly once, identically.
  const reader: Reader = createReader(
    {
      collections: options.collections.map((c) => ({ ...c, validate: false })),
      singles: (options.singles ?? []).map((s) => ({ ...s, validate: false })),
      i18n: options.i18n,
      adapters: options.adapters,
    },
    store
  );

  async function planCreate(
    collectionName: string,
    slug: string,
    meta: Record<string, unknown>,
    opts: Omit<PlanCreateOptions, "meta"> = {}
  ): Promise<WritePlan> {
    const collection = collections.get(collectionName);
    if (!collection) {
      if (singles.has(collectionName)) {
        throw new Error(
          `Cannot create entries in single "${collectionName}": singles are key-fixed; edit the file directly.`
        );
      }
      throw new Error(`Collection not found: ${collectionName}`);
    }
    if (isUnsafeSlug(slug)) {
      throw new Error(`Invalid slug: "${slug}"`);
    }

    const locale = opts.locale ?? i18n.defaultLocale;
    if (i18n.enabled && !locale) {
      throw new Error("Locale is required when i18n is enabled");
    }
    const extensions = extensionsFor(collection);
    // Default to the first extension with a registered adapter (rather than
    // blindly taking extensions[0], which may be unparseable). Explicit ext
    // still resolves strictly below.
    const ext =
      opts.ext ??
      extensions.find((e) => getAdapterForExtension(e, adapters)) ??
      extensions[0] ??
      "mdx";
    const fileName = i18n.enabled
      ? `${slug}.${locale}.${ext}`
      : `${slug}.${ext}`;
    const file = joinStoragePath(collection.dir, fileName);

    const adapter = getAdapterForExtension(ext, adapters);
    if (!adapter) {
      throw new Error(`No format adapter registered for extension: .${ext}`);
    }

    const exists = (await store.readFile(file)) !== null;

    // Fill schema defaults unless disabled (content-io writes raw).
    const nextMeta = { ...meta };
    if (opts.fillDefaults !== false && collection.schema) {
      const introspected = introspectSchema(collection.schema);
      for (const [fieldName, field] of Object.entries(introspected.fields)) {
        if (nextMeta[fieldName] === undefined && field.default !== undefined) {
          nextMeta[fieldName] = field.default;
        }
      }
    }

    let valid = true;
    let diagnostics: PlanDiagnostic[] = [];
    if (collection.schema && collection.validate !== false) {
      const result = validateMeta(
        nextMeta,
        collection.schema,
        `${collectionName}/${slug}`
      );
      valid = result.valid;
      diagnostics = toDiagnostics(result.errors);
    }

    const after = encode.encode(adapter.serialize(nextMeta, opts.body ?? ""));
    return {
      kind: "create",
      collection: collectionName,
      slug,
      locale: i18n.enabled ? (locale ?? null) : null,
      file,
      ext,
      before: null,
      after,
      meta: nextMeta,
      body: opts.body,
      valid,
      diagnostics,
      exists,
    };
  }

  /**
   * Enumerate-and-match fallback for custom slugPattern layouts (mirrors
   * findContentFile exactly, including the default-locale rule). Listing
   * errors (e.g. fetch without `.listing.json`) propagate explicitly.
   */
  async function matchUpdateTargetByListing(
    collection: ReaderCollectionConfig,
    slug: string,
    locale: string | undefined
  ): Promise<ReaderEntry | null> {
    const extensions = extensionsFor(collection);
    const ignore = ignoreFor(collection);
    const entries = await store.listdir(collection.dir);
    for (const entry of entries) {
      if (entry.kind !== "file" || matchIgnore(entry.name, ignore)) continue;
      const parsed = parseFileName(
        entry.name,
        i18n.enabled,
        collection.slugPattern,
        extensions
      );
      if (!parsed || parsed.slug !== slug) continue;
      if (i18n.enabled) {
        const want = locale ?? i18n.defaultLocale;
        if (parsed.locale !== want) continue;
      }
      const file = joinStoragePath(collection.dir, entry.name);
      const bytes = await store.readFile(file);
      if (!bytes) continue;
      return parseEntryBytes({
        file,
        ext: parsed.ext,
        slug,
        locale: parsed.locale ?? null,
        adapters,
        bytes,
      });
    }
    return null;
  }

  async function planUpdate(
    collectionName: string,
    slugOrUndefined: string | undefined,
    mutations: PlanUpdateMutations,
    locale?: string
  ): Promise<WritePlan> {
    const hasSet = mutations.set && Object.keys(mutations.set).length > 0;
    const hasUnset = mutations.unset && mutations.unset.length > 0;
    if (!hasSet && !hasUnset) {
      throw new Error("No mutations specified. Use --set or --unset.");
    }

    let slug = slugOrUndefined;
    const inCollections = collections.has(collectionName);
    const inSingles = singles.has(collectionName);
    if (!slug) {
      if (!inSingles) {
        throw new Error(
          `Slug is required (omit only for singles): ${collectionName}`
        );
      }
      slug = collectionName;
    }
    if (!inCollections && !inSingles) {
      throw new Error(`Content not found: ${collectionName}/${slug}`);
    }
    // Collections win on explicit slugs; singles on omitted ones. A wrong
    // slug against a single misses exactly like a file lookup would.
    const isSingle = !inCollections || (!slugOrUndefined && inSingles);
    if (isSingle && slug !== collectionName) {
      throw new Error(`Content not found: ${collectionName}/${slug}`);
    }

    // Exact-locale read: never edit through a fallback hit. Fast path probes
    // conventional names (no listing round-trip); custom slugPattern layouts
    // fall back to enumerate-and-match (mirrors findContentFile exactly).
    let current = isSingle
      ? await reader.singles[collectionName].read({ locale, fallback: false })
      : await reader.collections[collectionName].read(slug, {
          locale,
          fallback: false,
        });
    if (!current) {
      const source = isSingle ? undefined : collections.get(collectionName);
      if (source?.slugPattern) {
        current = await matchUpdateTargetByListing(source, slug, locale);
      }
    }
    if (!current) {
      throw new Error(`Content not found: ${collectionName}/${slug}`);
    }

    const merged: Record<string, unknown> = { ...current.meta };
    if (mutations.set) {
      for (const [key, value] of Object.entries(mutations.set)) {
        merged[key] = value;
      }
    }
    if (mutations.unset) {
      for (const key of mutations.unset) {
        delete merged[key];
      }
    }

    const source = isSingle
      ? singles.get(collectionName)
      : collections.get(collectionName);
    let valid = true;
    let diagnostics: PlanDiagnostic[] = [];
    if (source?.schema && source.validate !== false) {
      const result = validateMeta(
        merged,
        source.schema,
        `${collectionName}/${slug}`
      );
      valid = result.valid;
      diagnostics = toDiagnostics(result.errors);
    }

    const dot = current.file.lastIndexOf(".");
    const ext = dot === -1 ? "" : current.file.slice(dot + 1);
    const adapter = getAdapterForExtension(ext, adapters);
    if (!adapter) {
      throw new Error(`No format adapter registered for extension: .${ext}`);
    }
    const after = encode.encode(adapter.serialize(merged, current.body ?? ""));
    const before = await store.readFile(current.file);

    return {
      kind: "update",
      collection: collectionName,
      slug,
      locale: current.locale,
      file: current.file,
      ext,
      before,
      after,
      meta: merged,
      body: current.body,
      valid,
      diagnostics,
      exists: true,
    };
  }

  async function apply(plan: WritePlan): Promise<WriteReceipt> {
    if (!plan.valid) {
      throw new ValidationFailedError(plan.diagnostics);
    }
    const dir = dirnameOf(plan.file);
    if (dir && store.mkdir) {
      await store.mkdir(dir);
    }
    await store.writeFile(plan.file, plan.after);
    return {
      slug: plan.slug,
      collection: plan.collection,
      file: plan.file,
      meta: plan.meta,
      locale: plan.locale,
    };
  }

  async function create(
    collection: string,
    slug: string,
    meta: Record<string, unknown>,
    opts: Omit<PlanCreateOptions, "meta"> = {}
  ): Promise<WriteReceipt> {
    const plan = await planCreate(collection, slug, meta, opts);
    return apply(plan);
  }

  async function update(
    collection: string,
    slug: string | undefined,
    mutations: PlanUpdateMutations,
    locale?: string
  ): Promise<WriteReceipt> {
    const plan = await planUpdate(collection, slug, mutations, locale);
    return apply(plan);
  }

  return { planCreate, planUpdate, apply, create, update };
}
