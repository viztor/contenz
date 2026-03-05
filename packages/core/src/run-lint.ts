/**
 * Programmatic lint: validate content files and optionally write coverage report.
 * Used by the CLI and by @contenz/core/api.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { globby } from "globby";
import pMap from "p-map";
import pc from "picocolors";
import {
  extractRelations,
  getContentType,
  getSchemaForType,
  loadCollectionConfig,
  loadProjectConfig,
  loadSchemaModule,
  resolveConfig,
} from "./config.js";
import { parseContentFile, parseFileName } from "./parser.js";
import type { Relations } from "./types.js";
import {
  detectCircularReferences,
  formatValidationResults,
  type ValidationResult,
  validateMeta,
  validateRelations,
} from "./validator.js";

const LINT_CONCURRENCY = 4;

export interface LintResult {
  success: boolean;
  errors: number;
  report: string;
  coveragePath?: string;
}

export interface LintOptions {
  cwd: string;
  dir?: string;
  collection?: string;
  coverage?: boolean;
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
  lines: string[];
  coverageEntry: { name: string; total: number; locales: Record<string, number> };
  circularRefs: string[];
  selfRefs: string[];
  errorCount: number;
  validationResults: ValidationResult[];
}

async function firstPassOneCollection(
  schemaFile: string,
  contentDir: string,
  projectConfig: import("./types.js").ContenzConfig,
  availableCollections: string[]
): Promise<FirstPassResult> {
  const collectionName = path.dirname(schemaFile);
  const collectionPath = path.join(contentDir, collectionName);
  const lines: string[] = [];
  const slugs = new Set<string>();
  const slugLocales = new Map<string, Set<string>>();
  const itemsForCircularCheck = new Map<string, { slug: string; relatedSlugs: string[] }>();
  const validationResults: ValidationResult[] = [];

  const collectionConfig = await loadCollectionConfig(collectionPath);
  const config = resolveConfig(projectConfig, undefined, collectionConfig);

  const schemaModule = await loadSchemaModule(collectionPath);
  if (!schemaModule) {
    lines.push(pc.red(`${collectionName}/: Failed to load schema.ts`));
    return {
      collectionName,
      slugs,
      lines,
      coverageEntry: { name: collectionName, total: 0, locales: {} },
      circularRefs: [],
      selfRefs: [],
      errorCount: 1,
      validationResults: [],
    };
  }

  const rawSchema = schemaModule.meta || (schemaModule as Record<string, unknown>).metaSchema;
  if (!rawSchema) {
    lines.push(pc.red(`${collectionName}/: No meta or metaSchema export found`));
    return {
      collectionName,
      slugs,
      lines,
      coverageEntry: { name: collectionName, total: 0, locales: {} },
      circularRefs: [],
      selfRefs: [],
      errorCount: 1,
      validationResults: [],
    };
  }
  const defaultSchema = rawSchema as import("zod").ZodSchema;

  lines.push(pc.cyan(`Scanning ${collectionName}/...`));

  const extensionPattern = config.extensions.map((e) => `*.${e}`).join(",");
  const contentFiles = await globby(`{${extensionPattern}}`, {
    cwd: collectionPath,
    onlyFiles: true,
    ignore: config.ignore,
  });

  const relations: Relations =
    schemaModule.relations ?? extractRelations(schemaModule, availableCollections);

  for (const file of contentFiles) {
    const filePath = path.join(collectionPath, file);
    const parsed = parseFileName(file, config.i18n, config.slugPattern);
    if (!parsed) {
      lines.push(pc.yellow(`  ⚠ Skipping ${file} (invalid naming pattern)`));
      continue;
    }
    slugs.add(parsed.slug);
    try {
      const result = await parseContentFile(filePath, config);
      const contentType = getContentType(file, config);
      const schema = contentType
        ? (getSchemaForType(schemaModule, contentType) ?? defaultSchema)
        : defaultSchema;
      const validation = validateMeta(result.meta, schema, file);
      validationResults.push(validation);
      if (config.i18n && parsed.locale) {
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

  const errorCount = validationResults.reduce((sum, r) => sum + r.errors.length, 0);
  if (errorCount === 0) {
    lines.push(pc.green(`  ✓ ${contentFiles.length} files validated`));
  } else {
    lines.push(pc.red(`  ✗ ${errorCount} errors in ${contentFiles.length} files`));
  }
  lines.push(formatValidationResults(validationResults));

  const { circularRefs, selfRefs } = detectCircularReferences(itemsForCircularCheck);
  const coverageEntry = config.i18n
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
    lines,
    coverageEntry,
    circularRefs: circularRefs.map((r) => `${collectionName}: ${r}`),
    selfRefs: selfRefs.map((r) => `${collectionName}: ${r}`),
    errorCount,
    validationResults,
  };
}

interface SecondPassResult {
  lines: string[];
  relationErrors: number;
  missingRefs: MissingRef[];
}

async function secondPassOneCollection(
  schemaFile: string,
  contentDir: string,
  projectConfig: import("./types.js").ContenzConfig,
  collectionSlugs: Map<string, Set<string>>,
  availableCollections: string[]
): Promise<SecondPassResult> {
  const collectionName = path.dirname(schemaFile);
  const collectionPath = path.join(contentDir, collectionName);
  const lines: string[] = [];
  const missingRefs: MissingRef[] = [];
  let relationErrors = 0;

  const collectionConfig = await loadCollectionConfig(collectionPath);
  const config = resolveConfig(projectConfig, undefined, collectionConfig);
  const schemaModule = await loadSchemaModule(collectionPath);
  if (!schemaModule) return { lines, relationErrors: 0, missingRefs };

  const relations: Relations =
    schemaModule.relations ?? extractRelations(schemaModule, availableCollections);
  if (Object.keys(relations).length === 0) return { lines, relationErrors: 0, missingRefs };

  const extensionPattern = config.extensions.map((e) => `*.${e}`).join(",");
  const contentFiles = await globby(`{${extensionPattern}}`, {
    cwd: collectionPath,
    onlyFiles: true,
    ignore: config.ignore,
  });

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
        lines.push(pc.red(`  ✗ ${collectionName}/${error.file}: ${error.message}`));
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
        lines.push(pc.yellow(`  ⚠ ${collectionName}/${warning.file}: ${warning.message}`));
      }
    } catch {
      // Already reported in first pass
    }
  }
  if (relationErrors === 0 && Object.keys(relations).length > 0) {
    lines.push(pc.green(`  ✓ ${collectionName}: All relations valid`));
  }
  return { lines, relationErrors, missingRefs };
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
  const lines: string[] = [];
  const cwd = path.resolve(process.cwd(), options.cwd ?? ".");

  const projectConfig = await loadProjectConfig(cwd);
  const baseConfig = resolveConfig(projectConfig);
  const dir = options.dir ?? baseConfig.contentDir;
  const contentDir = path.resolve(cwd, dir);

  lines.push(pc.bold("\nContent Lint Report"));
  lines.push("===================\n");

  const schemaFiles = await globby("*/schema.ts", { cwd: contentDir, onlyFiles: true });
  const collections = options.collection
    ? schemaFiles.filter((f) => f.startsWith(`${options.collection}/`))
    : schemaFiles;

  if (schemaFiles.length === 0) {
    lines.push(pc.yellow("No schema.ts files found in the configured source directories."));
    return { success: true, errors: 0, report: lines.join("\n") };
  }
  if (collections.length === 0) {
    lines.push(pc.yellow(`Collection "${options.collection}" not found.`));
    return { success: false, errors: 1, report: lines.join("\n") };
  }

  const availableCollections = collections.map((f) => path.dirname(f));

  const firstPassResults = await pMap(
    collections,
    (schemaFile) =>
      firstPassOneCollection(schemaFile, contentDir, projectConfig, availableCollections),
    { concurrency: LINT_CONCURRENCY }
  );

  const collectionSlugs = new Map<string, Set<string>>();
  let totalErrors = 0;
  const allCircularRefs: string[] = [];
  const allSelfRefs: string[] = [];
  const coverageReport: { name: string; total: number; locales: Record<string, number> }[] = [];

  for (const r of firstPassResults) {
    lines.push(...r.lines);
    collectionSlugs.set(r.collectionName, r.slugs);
    totalErrors += r.errorCount;
    allCircularRefs.push(...r.circularRefs);
    allSelfRefs.push(...r.selfRefs);
    coverageReport.push(r.coverageEntry);
  }

  lines.push(pc.bold("\nRelation Validation"));
  lines.push("-------------------");

  const secondPassResults = await pMap(
    collections,
    (schemaFile) =>
      secondPassOneCollection(
        schemaFile,
        contentDir,
        projectConfig,
        collectionSlugs,
        availableCollections
      ),
    { concurrency: LINT_CONCURRENCY }
  );

  const allMissingRefs: MissingRef[] = [];
  for (const r of secondPassResults) {
    lines.push(...r.lines);
    totalErrors += r.relationErrors;
    allMissingRefs.push(...r.missingRefs);
  }

  if (allCircularRefs.length > 0) {
    lines.push(pc.blue("\nℹ Circular References (informational):"));
    for (const ref of allCircularRefs) lines.push(`  ${ref}`);
  }
  if (allSelfRefs.length > 0) {
    lines.push(pc.yellow("\n⚠ Self References:"));
    for (const ref of allSelfRefs) lines.push(`  ${ref}`);
  }

  lines.push(pc.bold("\nTranslation Coverage:"));
  for (const { name, total, locales } of coverageReport) {
    const localeStr = Object.entries(locales)
      .map(([l, c]) => `${l.toUpperCase()}: ${c}`)
      .join(", ");
    lines.push(`  ${name}: ${total} items${localeStr ? ` (${localeStr})` : ""}`);
  }

  let coveragePath: string | undefined;
  if (options.coverage) {
    coveragePath = path.resolve(cwd, baseConfig.coveragePath);
    await generateCoverageReportFile(
      coveragePath,
      coverageReport,
      allCircularRefs,
      allSelfRefs,
      allMissingRefs,
      totalErrors
    );
    lines.push(pc.dim(`\nCoverage report: ${path.relative(cwd, coveragePath)}`));
  }

  lines.push("");
  if (totalErrors > 0) {
    lines.push(pc.red(`Lint failed with ${totalErrors} error(s).`));
  } else {
    lines.push(pc.green("Lint passed."));
  }

  return {
    success: totalErrors === 0,
    errors: totalErrors,
    report: lines.join("\n"),
    coveragePath,
  };
}
