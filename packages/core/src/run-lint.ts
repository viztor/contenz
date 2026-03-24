/**
 * Programmatic lint: validate content files and optionally write coverage report.
 * Used by the CLI and by @contenz/core/api.
 */

import fs from "node:fs/promises";
import path from "node:path";

import pMap from "p-map";
import { extractRelations, getContentType, getSchemaForType } from "./config.js";
import { type Diagnostic, type DiagnosticFormat, formatDiagnosticsReport } from "./diagnostics.js";
import { parseContentFile, parseFileName } from "./parser.js";
import type { Relations } from "./types.js";
import {
  detectCircularReferences,
  type ValidationResult,
  validateMeta,
  validateRelations,
} from "./validator.js";
import { type CollectionContext, createWorkspace } from "./workspace.js";

const LINT_CONCURRENCY = 4;

export interface LintResult {
  success: boolean;
  errors: number;
  report: string;
  diagnostics: Diagnostic[];
  coveragePath?: string;
}

export interface LintOptions {
  cwd: string;
  format?: DiagnosticFormat;
  sources?: string[];
  /** @deprecated Use `sources` instead. */
  dir?: string;
  collection?: string;
  coverage?: boolean;
  /** Report only; do not write coverage report file */
  dryRun?: boolean;
}

interface MissingRef {
  collection: string;
  file: string;
  field: string;
  slug: string;
  target: string;
}

interface FirstPassResult {
  collectionName: string;
  slugs: Set<string>;
  diagnostics: Diagnostic[];
  coverageEntry: { name: string; total: number; locales: Record<string, number> };
  circularRefs: string[];
  selfRefs: string[];
  errorCount: number;
  validationResults: ValidationResult[];
}

async function firstPassOneCollection(
  ctx: CollectionContext,
  availableCollections: string[]
): Promise<FirstPassResult> {
  const { name: collectionName, collectionPath, config, schema: schemaModule, contentFiles } = ctx;
  const diagnostics: Diagnostic[] = [];
  const slugs = new Set<string>();
  const slugLocales = new Map<string, Set<string>>();
  const itemsForCircularCheck = new Map<string, { slug: string; relatedSlugs: string[] }>();
  const validationResults: ValidationResult[] = [];

  if (!schemaModule) {
    diagnostics.push({
      code: "SCHEMA_LOAD_FAILED",
      severity: "error",
      category: "schema",
      message: "Failed to load schema.ts.",
      source: "lint",
      collection: collectionName,
    });
    return {
      collectionName,
      slugs,
      diagnostics,
      coverageEntry: { name: collectionName, total: 0, locales: {} },
      circularRefs: [],
      selfRefs: [],
      errorCount: 1,
      validationResults: [],
    };
  }

  const rawSchema = schemaModule.meta;
  if (!rawSchema) {
    diagnostics.push({
      code: "SCHEMA_EXPORT_MISSING",
      severity: "error",
      category: "schema",
      message: "No meta export found in schema module.",
      source: "lint",
      collection: collectionName,
    });
    return {
      collectionName,
      slugs,
      diagnostics,
      coverageEntry: { name: collectionName, total: 0, locales: {} },
      circularRefs: [],
      selfRefs: [],
      errorCount: 1,
      validationResults: [],
    };
  }
  const defaultSchema = rawSchema as import("zod").ZodSchema;

  const effectiveConfig = {
    ...config,
    types: config.types?.length ? config.types : schemaModule.types,
  };

  const relations: Relations =
    schemaModule.relations ?? extractRelations(schemaModule, availableCollections);

  for (const file of contentFiles) {
    const filePath = path.join(collectionPath, file);
    const parsed = parseFileName(file, effectiveConfig.i18n, effectiveConfig.slugPattern);
    if (!parsed) {
      diagnostics.push({
        code: "CONTENT_FILE_SKIPPED",
        severity: "warning",
        category: "content",
        message: "Skipped file because it does not match the expected naming pattern.",
        source: "lint",
        collection: collectionName,
        file,
      });
      continue;
    }
    slugs.add(parsed.slug);
    try {
      const result = await parseContentFile(filePath, effectiveConfig);
      const contentType = getContentType(file, effectiveConfig);
      const schema = contentType
        ? (getSchemaForType(schemaModule, contentType) ?? defaultSchema)
        : defaultSchema;
      const validation = validateMeta(result.meta, schema, file);
      validationResults.push(validation);
      if (effectiveConfig.i18n && parsed.locale) {
        if (!slugLocales.has(parsed.slug)) slugLocales.set(parsed.slug, new Set());
        slugLocales.get(parsed.slug)?.add(parsed.locale);
      }
      const relatedSlugs: string[] = [];
      for (const field of Object.keys(relations)) {
        const value = result.meta[field];
        if (Array.isArray(value)) {
          relatedSlugs.push(...value.filter((v): v is string => typeof v === "string"));
        }
      }
      if (!itemsForCircularCheck.has(parsed.slug)) {
        itemsForCircularCheck.set(parsed.slug, { slug: parsed.slug, relatedSlugs: [] });
      }
      const existing = itemsForCircularCheck.get(parsed.slug);
      if (!existing) {
        validationResults.push({
          valid: false,
          errors: [{ file, field: "internal", message: "Failed to initialize relation tracking" }],
          warnings: [],
        });
        continue;
      }
      for (const slug of relatedSlugs) {
        if (!existing.relatedSlugs.includes(slug)) existing.relatedSlugs.push(slug);
      }
    } catch {
      validationResults.push({
        valid: false,
        errors: [{ file, field: "parse", message: "Parse error" }],
        warnings: [],
      });
    }
  }

  for (const result of validationResults) {
    for (const error of result.errors) {
      diagnostics.push({
        code: error.field === "parse" ? "CONTENT_PARSE_FAILED" : "META_VALIDATION_FAILED",
        severity: "error",
        category: error.field === "parse" ? "content" : "validation",
        message: error.message,
        source: "lint",
        collection: collectionName,
        file: error.file,
        field: error.field,
      });
    }
    for (const warning of result.warnings) {
      diagnostics.push({
        code: "VALIDATION_WARNING",
        severity: "warning",
        category: "validation",
        message: warning.message,
        source: "lint",
        collection: collectionName,
        file: warning.file,
      });
    }
  }

  const errorCount = validationResults.reduce((sum, r) => sum + r.errors.length, 0);

  const { circularRefs, selfRefs } = detectCircularReferences(itemsForCircularCheck);
  const coverageEntry = effectiveConfig.i18n
    ? (() => {
        const locales: Record<string, number> = {};
        for (const localeSet of slugLocales.values()) {
          for (const locale of localeSet) {
            locales[locale] = (locales[locale] ?? 0) + 1;
          }
        }
        return { name: collectionName, total: slugLocales.size, locales };
      })()
    : { name: collectionName, total: slugs.size, locales: {} as Record<string, number> };

  return {
    collectionName,
    slugs,
    diagnostics,
    coverageEntry,
    circularRefs: circularRefs.map((r) => `${collectionName}: ${r}`),
    selfRefs: selfRefs.map((r) => `${collectionName}: ${r}`),
    errorCount,
    validationResults,
  };
}

interface SecondPassResult {
  diagnostics: Diagnostic[];
  relationErrors: number;
  missingRefs: MissingRef[];
}

async function secondPassOneCollection(
  ctx: CollectionContext,
  collectionSlugs: Map<string, Set<string>>,
  availableCollections: string[]
): Promise<SecondPassResult> {
  const { name: collectionName, collectionPath, config, schema: schemaModule, contentFiles } = ctx;
  const diagnostics: Diagnostic[] = [];
  const missingRefs: MissingRef[] = [];
  let relationErrors = 0;

  if (!schemaModule) return { diagnostics, relationErrors: 0, missingRefs };

  const relations: Relations =
    schemaModule.relations ?? extractRelations(schemaModule, availableCollections);
  if (Object.keys(relations).length === 0) return { diagnostics, relationErrors: 0, missingRefs };

  for (const file of contentFiles) {
    const filePath = path.join(collectionPath, file);
    const parsed = parseFileName(file, config.i18n, config.slugPattern);
    if (!parsed) continue;
    try {
      const result = await parseContentFile(filePath, config);
      const validation = validateRelations(
        result.meta,
        file,
        relations,
        collectionSlugs,
        parsed.slug
      );
      relationErrors += validation.errors.length;
      for (const error of validation.errors) {
        diagnostics.push({
          code: error.targetCollection
            ? "RELATION_MISSING_SLUG"
            : "RELATION_TARGET_COLLECTION_MISSING",
          severity: "error",
          category: "relation",
          message: error.message,
          source: "lint",
          collection: collectionName,
          file: error.file,
          field: error.field,
        });
        if (error.missingSlug && error.targetCollection) {
          missingRefs.push({
            collection: collectionName,
            file: error.file,
            field: error.field,
            slug: error.missingSlug,
            target: error.targetCollection,
          });
        }
      }
      for (const warning of validation.warnings) {
        diagnostics.push({
          code: "RELATION_SELF_REFERENCE",
          severity: "warning",
          category: "relation",
          message: warning.message,
          source: "lint",
          collection: collectionName,
          file: warning.file,
        });
      }
    } catch {
      // Already reported in first pass
    }
  }
  return { diagnostics, relationErrors, missingRefs };
}

async function generateCoverageReportFile(
  outputPath: string,
  collections: { name: string; total: number; locales: Record<string, number> }[],
  circularRefs: string[],
  selfRefs: string[],
  missingRefs: MissingRef[],
  errorCount: number
): Promise<void> {
  const timestamp = new Date().toISOString();
  const allLocales = [...new Set(collections.flatMap((c) => Object.keys(c.locales)))].sort();
  let output = `# Content Coverage Report

Generated: ${timestamp}

## Summary

| Collection | Total |${allLocales.length > 0 ? ` ${allLocales.map((l) => l.toUpperCase()).join(" | ")} |` : ""} Complete | Coverage |
|------------|-------|${allLocales.map(() => "----").join("|")}${allLocales.length > 0 ? "|" : ""}----------|----------|
`;
  for (const { name, total, locales } of collections) {
    const localeCounts = allLocales.map((l) => locales[l] ?? 0);
    const complete = allLocales.length > 0 ? Math.min(...localeCounts) : total;
    const coverage = total > 0 ? Math.round((complete / total) * 100) : 100;
    const localeStr = allLocales.length > 0 ? ` ${localeCounts.join(" | ")} |` : "";
    output += `| ${name} | ${total} |${localeStr} ${complete} | ${coverage}% |\n`;
  }
  output += "\n## Missing Translations\n";
  for (const { name, locales } of collections) {
    output += `\n### ${name}\n\n`;
    const localeKeys = Object.keys(locales);
    if (localeKeys.length === 0) {
      output += "No i18n enabled for this collection.\n";
      continue;
    }
    const counts = localeKeys.map((l) => locales[l]);
    const maxCount = Math.max(...counts);
    const missingLocales = localeKeys.filter((l) => locales[l] < maxCount);
    if (missingLocales.length === 0) {
      output += "All translations complete.\n";
    } else {
      for (const locale of missingLocales) {
        output += `- ${locale.toUpperCase()}: ${maxCount - locales[locale]} missing translation(s)\n`;
      }
    }
  }
  output += "\n## Relation Validation\n\n";
  output += errorCount > 0 ? `**${errorCount} error(s) found.**\n\n` : "All relations valid.\n\n";
  if (missingRefs.length > 0) {
    output += "### Errors (Missing References)\n\n";
    const groupedBySlug = new Map<string, MissingRef[]>();
    for (const ref of missingRefs) {
      const key = `${ref.target}:${ref.slug}`;
      if (!groupedBySlug.has(key)) groupedBySlug.set(key, []);
      groupedBySlug.get(key)?.push(ref);
    }
    for (const key of [...groupedBySlug.keys()].sort()) {
      const refs = groupedBySlug.get(key);
      if (!refs || refs.length === 0) continue;
      const { target, slug } = refs[0];
      const files = [...new Set(refs.map((r) => `${r.collection}/${r.file}`))];
      output += `- \`${slug}\` not found in **${target}**\n`;
      output += `  - Referenced by: ${files.slice(0, 3).join(", ")}${files.length > 3 ? ` (+${files.length - 3} more)` : ""}\n`;
    }
    output += "\n";
  }
  if (selfRefs.length > 0) {
    output += "### Warnings (Self References)\n\n";
    for (const ref of selfRefs) output += `- ${ref}\n`;
    output += "\n";
  }
  if (circularRefs.length > 0) {
    output +=
      "### Info (Circular References)\n\n_Circular references are allowed but noted for awareness._\n\n";
    for (const ref of circularRefs.slice(0, 20)) output += `- ${ref}\n`;
    if (circularRefs.length > 20) output += `- _...and ${circularRefs.length - 20} more_\n`;
  }
  await fs.writeFile(outputPath, output, "utf-8");
}

export async function runLint(options: LintOptions): Promise<LintResult> {
  const diagnostics: Diagnostic[] = [];
  const cwd = path.resolve(process.cwd(), options.cwd ?? ".");
  const format = options.format ?? "pretty";

  // ── Bootstrap via Workspace ──────────────────────────────────────────
  let workspace: Awaited<ReturnType<typeof createWorkspace>>;
  try {
    workspace = await createWorkspace({
      cwd,
      sources: options.sources,
      dir: options.dir,
      collection: options.collection,
    });
  } catch (error) {
    diagnostics.push({
      code: "CONFIG_INVALID",
      severity: "error",
      category: "config",
      message: error instanceof Error ? error.message : String(error),
      source: "lint",
    });
    return {
      success: false,
      errors: 1,
      report: formatDiagnosticsReport({
        diagnostics,
        format,
        title: "Lint diagnostics",
        success: false,
      }),
      diagnostics,
    };
  }

  const { resolvedConfig: baseConfig, sources, collections } = workspace;

  if (workspace.discoveryErrors.length > 0) {
    for (const error of workspace.discoveryErrors) {
      diagnostics.push({
        code: "DISCOVERY_DUPLICATE_COLLECTION",
        severity: "error",
        category: "discovery",
        message: error,
        source: "lint",
      });
    }
    return {
      success: false,
      errors: workspace.discoveryErrors.length,
      report: formatDiagnosticsReport({
        diagnostics,
        format,
        title: "Lint diagnostics",
        success: false,
      }),
      diagnostics,
    };
  }

  if (collections.length === 0) {
    // If filtering by collection and no match, it's an error
    if (options.collection) {
      diagnostics.push({
        code: "DISCOVERY_COLLECTION_NOT_FOUND",
        severity: "error",
        category: "discovery",
        message: `Collection "${options.collection}" not found.`,
        source: "lint",
      });
      return {
        success: false,
        errors: 1,
        report: formatDiagnosticsReport({
          diagnostics,
          format,
          title: "Lint diagnostics",
          success: false,
          footer: `Sources: ${sources.join(", ")}`,
        }),
        diagnostics,
      };
    }
    diagnostics.push({
      code: "DISCOVERY_NO_COLLECTIONS",
      severity: "warning",
      category: "discovery",
      message: "No schema.ts files found in the configured sources.",
      source: "lint",
    });
    return {
      success: true,
      errors: 0,
      report: formatDiagnosticsReport({
        diagnostics,
        format,
        title: "Lint diagnostics",
        success: true,
        footer: `Sources: ${sources.join(", ")}`,
      }),
      diagnostics,
    };
  }

  const availableCollections = collections.map((c) => c.name);

  const firstPassResults = await pMap(
    collections,
    (ctx) => firstPassOneCollection(ctx, availableCollections),
    { concurrency: LINT_CONCURRENCY }
  );

  const collectionSlugs = new Map<string, Set<string>>();
  let totalErrors = 0;
  const allCircularRefs: string[] = [];
  const allSelfRefs: string[] = [];
  const coverageReport: { name: string; total: number; locales: Record<string, number> }[] = [];

  for (const r of firstPassResults) {
    diagnostics.push(...r.diagnostics);
    collectionSlugs.set(r.collectionName, r.slugs);
    totalErrors += r.errorCount;
    allCircularRefs.push(...r.circularRefs);
    allSelfRefs.push(...r.selfRefs);
    coverageReport.push(r.coverageEntry);
  }

  const secondPassResults = await pMap(
    collections,
    (ctx) => secondPassOneCollection(ctx, collectionSlugs, availableCollections),
    { concurrency: LINT_CONCURRENCY }
  );

  const allMissingRefs: MissingRef[] = [];
  for (const r of secondPassResults) {
    diagnostics.push(...r.diagnostics);
    totalErrors += r.relationErrors;
    allMissingRefs.push(...r.missingRefs);
  }

  if (allCircularRefs.length > 0) {
    for (const ref of allCircularRefs) {
      diagnostics.push({
        code: "RELATION_CIRCULAR_REFERENCE",
        severity: "info",
        category: "relation",
        message: ref,
        source: "lint",
      });
    }
  }
  if (allSelfRefs.length > 0) {
    for (const ref of allSelfRefs) {
      diagnostics.push({
        code: "RELATION_SELF_REFERENCE",
        severity: "warning",
        category: "relation",
        message: ref,
        source: "lint",
      });
    }
  }

  let coveragePath: string | undefined;
  if (options.coverage && !options.dryRun) {
    coveragePath = path.resolve(cwd, baseConfig.coveragePath);
    await generateCoverageReportFile(
      coveragePath,
      coverageReport,
      allCircularRefs,
      allSelfRefs,
      allMissingRefs,
      totalErrors
    );
  }

  return {
    success: totalErrors === 0,
    errors: totalErrors,
    report: formatDiagnosticsReport({
      diagnostics,
      format,
      title: "Lint diagnostics",
      success: totalErrors === 0,
      metadata: { coveragePath },
      footer:
        `Sources: ${sources.join(", ")}` +
        (coveragePath ? `\nCoverage report: ${path.relative(cwd, coveragePath)}` : ""),
    }),
    diagnostics,
    coveragePath,
  };
}
