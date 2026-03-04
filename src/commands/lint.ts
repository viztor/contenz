import { defineCommand } from "citty";
import { globby } from "globby";
import path from "node:path";
import fs from "node:fs/promises";
import pc from "picocolors";
import { parseContentFile, parseFileName } from "../parser.js";
import {
  validateMeta,
  validateRelations,
  detectCircularReferences,
  ValidationResult,
  formatValidationResults,
} from "../validator.js";
import {
  loadProjectConfig,
  loadCollectionConfig,
  loadSchemaModule,
  resolveConfig,
  getSchemaForType,
  getContentType,
  extractRelations,
} from "../config.js";
import type { Relations } from "../types.js";

export const lintCommand = defineCommand({
  meta: {
    name: "lint",
    description: "Validate content files against their schemas",
  },
  args: {
    dir: {
      type: "string",
      description: "Content directory to lint",
      default: "content",
    },
    collection: {
      type: "string",
      description: "Specific collection to lint (optional)",
      required: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const projectConfig = await loadProjectConfig(cwd);
    const contentDir = path.resolve(cwd, args.dir);

    console.log(pc.bold("\nContent Lint Report"));
    console.log("===================\n");

    // Find all collections (directories with schema.ts)
    const schemaFiles = await globby("*/schema.ts", {
      cwd: contentDir,
      onlyFiles: true,
    });

    if (schemaFiles.length === 0) {
      console.log(pc.yellow("No schema.ts files found in content directories."));
      process.exit(0);
    }

    // Filter to specific collection if requested
    const collections = args.collection
      ? schemaFiles.filter((f) => f.startsWith(`${args.collection}/`))
      : schemaFiles;

    if (collections.length === 0) {
      console.log(pc.yellow(`Collection "${args.collection}" not found.`));
      process.exit(1);
    }

    // First pass: collect all slugs from all collections for relation validation
    const collectionSlugs = new Map<string, Set<string>>();
    const availableCollections = collections.map((f) => path.dirname(f));

    let totalErrors = 0;
    const allCircularRefs: string[] = [];
    const allSelfRefs: string[] = [];
    const allMissingRefs: { collection: string; file: string; field: string; slug: string; target: string }[] = [];
    const coverageReport: { name: string; total: number; locales: Record<string, number> }[] = [];

    for (const schemaFile of collections) {
      const collectionName = path.dirname(schemaFile);
      const collectionPath = path.join(contentDir, collectionName);

      // Load config
      const collectionConfig = await loadCollectionConfig(collectionPath);
      const config = resolveConfig(projectConfig, undefined, collectionConfig);

      // Load schema
      const schemaModule = await loadSchemaModule(collectionPath);
      if (!schemaModule) {
        console.log(pc.red(`${collectionName}/: Failed to load schema.ts`));
        totalErrors++;
        continue;
      }

      // Get schema (support both old metaSchema and new meta)
      const rawSchema =
        schemaModule.meta ||
        (schemaModule as Record<string, unknown>).metaSchema;
      if (!rawSchema) {
        console.log(pc.red(`${collectionName}/: No meta or metaSchema export found`));
        totalErrors++;
        continue;
      }
      const defaultSchema = rawSchema as import("zod").ZodSchema;

      console.log(pc.cyan(`Scanning ${collectionName}/...`));

      // Find content files
      const extensionPattern = config.extensions.map((e) => `*.${e}`).join(",");
      const contentFiles = await globby(`{${extensionPattern}}`, {
        cwd: collectionPath,
        onlyFiles: true,
        ignore: config.ignore,
      });

      const validationResults: ValidationResult[] = [];
      const slugLocales = new Map<string, Set<string>>();
      const itemsForCircularCheck = new Map<string, { slug: string; relatedSlugs: string[] }>();
      const slugs = new Set<string>();

      // Get relations config
      const relations: Relations =
        schemaModule.relations ??
        extractRelations(schemaModule, availableCollections);

      for (const file of contentFiles) {
        const filePath = path.join(collectionPath, file);
        const parsed = parseFileName(file, config.i18n, config.slugPattern);

        if (!parsed) {
          console.log(pc.yellow(`  ⚠ Skipping ${file} (invalid naming pattern)`));
          continue;
        }

        slugs.add(parsed.slug);

        try {
          const result = await parseContentFile(filePath, config);

          // Determine content type and get appropriate schema
          const contentType = getContentType(file, config);
          const schema = contentType
            ? getSchemaForType(schemaModule, contentType) ?? defaultSchema
            : defaultSchema;

          const validation = validateMeta(result.meta, schema, file);
          validationResults.push(validation);

          // Track locales for coverage
          if (config.i18n && parsed.locale) {
            if (!slugLocales.has(parsed.slug)) {
              slugLocales.set(parsed.slug, new Set());
            }
            slugLocales.get(parsed.slug)!.add(parsed.locale);
          }

          // Collect related slugs for circular reference detection
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
          const existing = itemsForCircularCheck.get(parsed.slug)!;
          for (const slug of relatedSlugs) {
            if (!existing.relatedSlugs.includes(slug)) {
              existing.relatedSlugs.push(slug);
            }
          }
        } catch (error) {
          validationResults.push({
            valid: false,
            errors: [{ file, field: "parse", message: String(error) }],
            warnings: [],
          });
        }
      }

      // Store slugs for relation validation
      collectionSlugs.set(collectionName, slugs);

      const errorCount = validationResults.reduce((sum, r) => sum + r.errors.length, 0);

      if (errorCount === 0) {
        console.log(pc.green(`  ✓ ${contentFiles.length} files validated`));
      } else {
        console.log(pc.red(`  ✗ ${errorCount} errors in ${contentFiles.length} files`));
      }

      totalErrors += errorCount;

      // Detect circular references
      const { circularRefs, selfRefs } = detectCircularReferences(
        itemsForCircularCheck
      );
      allCircularRefs.push(...circularRefs.map((r) => `${collectionName}: ${r}`));
      allSelfRefs.push(...selfRefs.map((r) => `${collectionName}: ${r}`));

      // Coverage stats
      if (config.i18n) {
        const locales: Record<string, number> = {};
        for (const localeSet of slugLocales.values()) {
          for (const locale of localeSet) {
            locales[locale] = (locales[locale] ?? 0) + 1;
          }
        }
        coverageReport.push({ name: collectionName, total: slugLocales.size, locales });
      } else {
        coverageReport.push({ name: collectionName, total: slugs.size, locales: {} });
      }

      console.log(formatValidationResults(validationResults));
    }

    // Second pass: validate relations across collections
    console.log(pc.bold("\nRelation Validation"));
    console.log("-------------------");

    for (const schemaFile of collections) {
      const collectionName = path.dirname(schemaFile);
      const collectionPath = path.join(contentDir, collectionName);

      const collectionConfig = await loadCollectionConfig(collectionPath);
      const config = resolveConfig(projectConfig, undefined, collectionConfig);

      const schemaModule = await loadSchemaModule(collectionPath);
      if (!schemaModule) continue;

      const relations: Relations =
        schemaModule.relations ??
        extractRelations(schemaModule, availableCollections);

      if (Object.keys(relations).length === 0) continue;

      const extensionPattern = config.extensions.map((e) => `*.${e}`).join(",");
      const contentFiles = await globby(`{${extensionPattern}}`, {
        cwd: collectionPath,
        onlyFiles: true,
        ignore: config.ignore,
      });

      let relationErrors = 0;

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
            console.log(pc.red(`  ✗ ${collectionName}/${error.file}: ${error.message}`));
            
            // Collect missing references for coverage report
            if (error.missingSlug && error.targetCollection) {
              allMissingRefs.push({
                collection: collectionName,
                file: error.file,
                field: error.field,
                slug: error.missingSlug,
                target: error.targetCollection,
              });
            }
          }

          for (const warning of validation.warnings) {
            console.log(pc.yellow(`  ⚠ ${collectionName}/${warning.file}: ${warning.message}`));
          }
        } catch {
          // Already reported in first pass
        }
      }

      if (relationErrors === 0 && Object.keys(relations).length > 0) {
        console.log(pc.green(`  ✓ ${collectionName}: All relations valid`));
      }

      totalErrors += relationErrors;
    }

    // Report circular references
    if (allCircularRefs.length > 0) {
      console.log(pc.blue("\nℹ Circular References (informational):"));
      for (const ref of allCircularRefs) {
        console.log(`  ${ref}`);
      }
    }

    if (allSelfRefs.length > 0) {
      console.log(pc.yellow("\n⚠ Self References:"));
      for (const ref of allSelfRefs) {
        console.log(`  ${ref}`);
      }
    }

    // Coverage summary
    console.log(pc.bold("\nTranslation Coverage:"));
    for (const { name, total, locales } of coverageReport) {
      const localeStr = Object.entries(locales)
        .map(([l, c]) => `${l.toUpperCase()}: ${c}`)
        .join(", ");
      console.log(`  ${name}: ${total} items${localeStr ? ` (${localeStr})` : ""}`);
    }

    // Generate coverage report file (in project root by default)
    const baseConfig = resolveConfig(projectConfig);
    const coveragePath = path.resolve(cwd, baseConfig.coveragePath);
    await generateCoverageReportFile(
      coveragePath,
      coverageReport,
      allCircularRefs,
      allSelfRefs,
      allMissingRefs,
      totalErrors
    );
    console.log(pc.dim(`\nCoverage report: ${path.relative(cwd, coveragePath)}`));

    console.log("");

    if (totalErrors > 0) {
      console.log(pc.red(`Lint failed with ${totalErrors} error(s).`));
      process.exit(1);
    } else {
      console.log(pc.green("Lint passed."));
      process.exit(0);
    }
  },
});

interface MissingRef {
  collection: string;
  file: string;
  field: string;
  slug: string;
  target: string;
}

/**
 * Generate coverage report markdown file.
 */
async function generateCoverageReportFile(
  outputPath: string,
  collections: { name: string; total: number; locales: Record<string, number> }[],
  circularRefs: string[],
  selfRefs: string[],
  missingRefs: MissingRef[],
  errorCount: number
): Promise<void> {
  const timestamp = new Date().toISOString();

  // Get all unique locales
  const allLocales = [
    ...new Set(collections.flatMap((c) => Object.keys(c.locales))),
  ].sort();

  let output = `# Content Coverage Report

Generated: ${timestamp}

## Summary

| Collection | Total |${allLocales.length > 0 ? ` ${allLocales.map((l) => l.toUpperCase()).join(" | ")} |` : ""} Complete | Coverage |
|------------|-------|${allLocales.map(() => "----").join("|")}${allLocales.length > 0 ? "|" : ""}----------|----------|
`;

  for (const { name, total, locales } of collections) {
    const localeCounts = allLocales.map((l) => locales[l] ?? 0);
    const complete = allLocales.length > 0
      ? Math.min(...localeCounts)
      : total;
    const coverage = total > 0 ? Math.round((complete / total) * 100) : 100;
    
    const localeStr = allLocales.length > 0
      ? ` ${localeCounts.join(" | ")} |`
      : "";
    output += `| ${name} | ${total} |${localeStr} ${complete} | ${coverage}% |\n`;
  }

  // Missing translations
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
        const missing = maxCount - locales[locale];
        output += `- ${locale.toUpperCase()}: ${missing} missing translation(s)\n`;
      }
    }
  }

  // Relation validation
  output += "\n## Relation Validation\n\n";

  if (errorCount > 0) {
    output += `**${errorCount} error(s) found.**\n\n`;
  } else {
    output += "All relations valid.\n\n";
  }

  // Missing references (errors)
  if (missingRefs.length > 0) {
    output += "### Errors (Missing References)\n\n";
    
    // Group by target collection and slug for deduplication
    const groupedBySlug = new Map<string, MissingRef[]>();
    for (const ref of missingRefs) {
      const key = `${ref.target}:${ref.slug}`;
      if (!groupedBySlug.has(key)) {
        groupedBySlug.set(key, []);
      }
      groupedBySlug.get(key)!.push(ref);
    }

    // Sort by target collection, then by slug
    const sortedKeys = [...groupedBySlug.keys()].sort();
    
    for (const key of sortedKeys) {
      const refs = groupedBySlug.get(key)!;
      const { target, slug } = refs[0];
      const files = [...new Set(refs.map((r) => `${r.collection}/${r.file}`))];
      
      output += `- \`${slug}\` not found in **${target}**\n`;
      output += `  - Referenced by: ${files.slice(0, 3).join(", ")}`;
      if (files.length > 3) {
        output += ` (+${files.length - 3} more)`;
      }
      output += "\n";
    }
    output += "\n";
  }

  if (selfRefs.length > 0) {
    output += "### Warnings (Self References)\n\n";
    for (const ref of selfRefs) {
      output += `- ${ref}\n`;
    }
    output += "\n";
  }

  if (circularRefs.length > 0) {
    output += "### Info (Circular References)\n\n";
    output += "_Circular references are allowed but noted for awareness._\n\n";
    for (const ref of circularRefs.slice(0, 20)) {
      output += `- ${ref}\n`;
    }
    if (circularRefs.length > 20) {
      output += `- _...and ${circularRefs.length - 20} more_\n`;
    }
  }

  await fs.writeFile(outputPath, output, "utf-8");
}
