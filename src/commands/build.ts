import { defineCommand } from "citty";
import { globby } from "globby";
import path from "node:path";
import fs from "node:fs/promises";
import pc from "picocolors";
import { parseContentFile, parseFileName } from "../parser.js";
import { validateMeta } from "../validator.js";
import {
  I18nCollectionData,
  FlatCollectionData,
  calculateI18nStats,
  generateI18nCollectionFile,
  generateFlatCollectionFile,
  generateIndexFile,
  generateTypeFromZod,
} from "../generator.js";
import {
  loadProjectConfig,
  loadCollectionConfig,
  loadSchemaModule,
  resolveConfig,
  getSchemaForType,
  getContentType,
} from "../config.js";

export const buildCommand = defineCommand({
  meta: {
    name: "build",
    description: "Generate content data files",
  },
  args: {
    dir: {
      type: "string",
      description: "Content directory to build",
      default: "content",
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const projectConfig = await loadProjectConfig(cwd);
    const contentDir = path.resolve(cwd, args.dir);
    
    // Resolve output directory from config
    const baseConfig = resolveConfig(projectConfig);
    const outputDir = path.resolve(cwd, baseConfig.outputDir);
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    console.log(pc.bold("\nBuilding content collections...\n"));
    console.log(pc.dim(`Output: ${path.relative(cwd, outputDir)}/\n`));

    // Find all collections
    const schemaFiles = await globby("*/schema.ts", {
      cwd: contentDir,
      onlyFiles: true,
    });

    if (schemaFiles.length === 0) {
      console.log(pc.yellow("No schema.ts files found in content directories."));
      process.exit(0);
    }

    const allCollections: {
      name: string;
      items: I18nCollectionData[];
      stats: ReturnType<typeof calculateI18nStats>;
      locales: string[];
      types?: string[];
      hasI18n: boolean;
      metaTypeName?: string;
    }[] = [];

    let hasErrors = false;

    for (const schemaFile of schemaFiles) {
      const collectionName = path.dirname(schemaFile);
      const collectionPath = path.join(contentDir, collectionName);

      // Load config
      const collectionConfig = await loadCollectionConfig(collectionPath);
      const config = resolveConfig(projectConfig, undefined, collectionConfig);

      // Load schema
      const schemaModule = await loadSchemaModule(collectionPath);
      if (!schemaModule) {
        console.log(pc.red(`${collectionName}/: Failed to load schema.ts`));
        hasErrors = true;
        continue;
      }

      // Get schema (support both old metaSchema and new meta)
      const rawSchema =
        schemaModule.meta ||
        (schemaModule as Record<string, unknown>).metaSchema;
      if (!rawSchema) {
        console.log(pc.red(`${collectionName}/: No meta or metaSchema export found`));
        hasErrors = true;
        continue;
      }
      const defaultSchema = rawSchema as import("zod").ZodSchema;

      console.log(pc.cyan(`${collectionName}/`));

      // Find content files
      const extensionPattern = config.extensions.map((e) => `*.${e}`).join(",");
      const contentFiles = await globby(`{${extensionPattern}}`, {
        cwd: collectionPath,
        onlyFiles: true,
        ignore: config.ignore,
      });

      // Group by content type if multi-type collection
      const typeGroups = new Map<string, Map<string, I18nCollectionData | FlatCollectionData>>();
      const defaultTypeName = "default";

      let parseErrors = 0;
      const detectedLocales = new Set<string>();

      for (const file of contentFiles) {
        const filePath = path.join(collectionPath, file);
        const parsed = parseFileName(file, config.i18n, config.slugPattern);

        if (!parsed) {
          console.log(pc.yellow(`  ⚠ Skipping ${file} (invalid naming pattern)`));
          continue;
        }

        try {
          const result = await parseContentFile(filePath, config);

          // Determine content type
          const contentType = getContentType(file, config) ?? defaultTypeName;
          const schema = contentType !== defaultTypeName
            ? getSchemaForType(schemaModule, contentType) ?? defaultSchema
            : defaultSchema;

          const validation = validateMeta(result.meta, schema, file);

          if (!validation.valid) {
            parseErrors++;
            for (const error of validation.errors) {
              console.log(pc.red(`  ✗ ${file}: ${error.field} - ${error.message}`));
            }
            continue;
          }

          // Initialize type group if needed
          if (!typeGroups.has(contentType)) {
            typeGroups.set(contentType, new Map());
          }
          const itemsMap = typeGroups.get(contentType)!;

          if (config.i18n && parsed.locale) {
            detectedLocales.add(parsed.locale);

            if (!itemsMap.has(parsed.slug)) {
              itemsMap.set(parsed.slug, { slug: parsed.slug, locales: {} });
            }

            const item = itemsMap.get(parsed.slug) as I18nCollectionData;
            item.locales[parsed.locale] = {
              file,
              meta: result.meta,
            };
          } else {
            itemsMap.set(parsed.slug, {
              slug: parsed.slug,
              file,
              meta: result.meta,
            } as FlatCollectionData);
          }
        } catch (error) {
          parseErrors++;
          console.log(pc.red(`  ✗ ${file}: ${String(error)}`));
        }
      }

      if (parseErrors > 0) {
        hasErrors = true;
        continue;
      }

      // Generate data files for each type
      const types = config.types?.map((t) => t.name) ?? [];
      const locales = [...detectedLocales].sort();

      // Output path for this collection: generated/content/{collection}.ts
      const collectionOutputPath = path.join(outputDir, `${collectionName}.ts`);
      
      if (types.length > 0) {
        // Multi-type collection: generate separate exports for each type
        for (const [typeName, itemsMap] of typeGroups) {
          if (typeName === defaultTypeName) continue;

          const items = Array.from(itemsMap.values()).sort((a, b) =>
            a.slug.localeCompare(b.slug)
          );

          console.log(pc.dim(`  ✓ Parsed ${items.length} ${typeName} items`));
        }

        // Generate combined file for multi-type collection
        await generateMultiTypeCollectionFile(
          collectionOutputPath,
          collectionName,
          typeGroups,
          config.i18n,
          locales,
          schemaModule as Record<string, unknown>
        );
        
        // Collect for index generation (multi-type)
        allCollections.push({
          name: collectionName,
          items: [],
          stats: { total: 0, locales: {}, complete: 0, coverage: 1, missingTranslations: [] },
          locales,
          types,
          hasI18n: config.i18n,
        });
      } else {
        // Single-type collection
        const itemsMap = typeGroups.get(defaultTypeName) ?? new Map();
        const items = Array.from(itemsMap.values()).sort((a, b) =>
          a.slug.localeCompare(b.slug)
        );

        // Get meta type name from schema module or derive from collection name
        const metaTypeName =
          (schemaModule as Record<string, unknown>).metaTypeName as string ??
          `${collectionName.charAt(0).toUpperCase() + collectionName.slice(1)}Meta`;

        if (config.i18n) {
          await generateI18nCollectionFile(
            collectionOutputPath,
            collectionName,
            items as I18nCollectionData[],
            metaTypeName,
            locales,
            defaultSchema
          );
          
          // Collect for index generation
          allCollections.push({
            name: collectionName,
            items: items as I18nCollectionData[],
            stats: calculateI18nStats(items as I18nCollectionData[]),
            locales,
            hasI18n: true,
            metaTypeName,
          });
        } else {
          await generateFlatCollectionFile(
            collectionOutputPath,
            collectionName,
            items as FlatCollectionData[],
            metaTypeName,
            defaultSchema
          );
          
          // Collect for index generation (non-i18n)
          allCollections.push({
            name: collectionName,
            items: [],
            stats: { total: items.length, locales: {}, complete: items.length, coverage: 1, missingTranslations: [] },
            locales: [],
            hasI18n: false,
            metaTypeName,
          });
        }

        console.log(pc.dim(`  ✓ Parsed ${contentFiles.length} files (${items.length} slugs)`));
      }

      console.log(pc.green(`  ✓ Generated ${collectionName}.ts`));
    }

    // Generate index.ts in output directory
    const indexPath = path.join(outputDir, "index.ts");
    await generateIndexFile(
      indexPath,
      allCollections.map(({ name, types, hasI18n, metaTypeName }) => ({ name, types, hasI18n, metaTypeName }))
    );
    console.log(pc.green(`\nGenerated ${path.relative(cwd, outputDir)}/index.ts`));

    if (hasErrors) {
      console.log(pc.red("\nBuild completed with errors."));
      process.exit(1);
    } else {
      console.log(pc.green("\nBuild complete."));
      console.log(pc.dim("Run `npm run content:lint` to generate coverage report."));
      process.exit(0);
    }
  },
});

/**
 * Generate {collection}.ts for multi-type collections.
 * Output goes to generated/content/{collection}.ts
 */
async function generateMultiTypeCollectionFile(
  outputPath: string,
  collectionName: string,
  typeGroups: Map<string, Map<string, I18nCollectionData | FlatCollectionData>>,
  i18n: boolean,
  locales: string[],
  schemaModule: Record<string, unknown>
): Promise<void> {
  let output = `// Auto-generated by content-tools - DO NOT EDIT
// Run: npm run content:build

`;

  // Generate inline types from Zod schemas for each type
  for (const typeName of typeGroups.keys()) {
    if (typeName === "default") continue;
    const pascalName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
    const metaTypeName = `${pascalName}Meta`;
    
    // Look for schema: {type}Meta or {type}
    const schema = schemaModule[`${typeName}Meta`] || schemaModule[typeName];
    if (schema && typeof schema === "object" && "_def" in schema) {
      output += generateTypeFromZod(schema as import("zod").ZodTypeAny, metaTypeName);
      output += "\n\n";
    } else {
      output += `export interface ${metaTypeName} {\n  [key: string]: unknown;\n}\n\n`;
    }
  }

  // Generate interfaces and data for each type
  for (const [typeName, itemsMap] of typeGroups) {
    if (typeName === "default") continue;

    const pascalName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
    const items = Array.from(itemsMap.values()).sort((a, b) =>
      a.slug.localeCompare(b.slug)
    );

    if (i18n) {
      output += `export interface ${pascalName}Entry extends ${pascalName}Meta {
  slug: string;
  file: string;
}

export interface ${pascalName}Item {
  slug: string;
  locales: {
${locales.map((l) => `    ${l}?: ${pascalName}Entry;`).join("\n")}
  };
}

export const ${typeName}s: Record<string, ${pascalName}Item> = `;

      const dataObj: Record<string, unknown> = {};
      for (const item of items as I18nCollectionData[]) {
        const itemData: Record<string, unknown> = {
          slug: item.slug,
          locales: {},
        };

        for (const [locale, entry] of Object.entries(item.locales)) {
          (itemData.locales as Record<string, unknown>)[locale] = {
            slug: item.slug,
            file: entry.file,
            ...entry.meta,
          };
        }

        dataObj[item.slug] = itemData;
      }

      output += JSON.stringify(dataObj, null, 2);
      output += ";\n\n";

      output += `export const ${typeName}sSlugs = Object.keys(${typeName}s) as (keyof typeof ${typeName}s)[];\n\n`;

      const stats = calculateI18nStats(items as I18nCollectionData[]);
      output += `export const ${typeName}sStats = ${JSON.stringify(stats, null, 2)};\n\n`;
    } else {
      output += `export interface ${pascalName}Entry extends ${pascalName}Meta {
  slug: string;
  file: string;
}

export const ${typeName}s: Record<string, ${pascalName}Entry> = `;

      const dataObj: Record<string, unknown> = {};
      for (const item of items as FlatCollectionData[]) {
        dataObj[item.slug] = {
          slug: item.slug,
          file: item.file,
          ...item.meta,
        };
      }

      output += JSON.stringify(dataObj, null, 2);
      output += ";\n\n";

      output += `export const ${typeName}sSlugs = Object.keys(${typeName}s) as (keyof typeof ${typeName}s)[];\n\n`;
      output += `export const ${typeName}sStats = { total: ${items.length} };\n\n`;
    }
  }

  await fs.writeFile(outputPath, output, "utf-8");
}

// Re-export for type usage
export type { ZodTypeAny } from "zod";
