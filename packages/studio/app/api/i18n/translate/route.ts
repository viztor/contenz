import fs from "node:fs/promises";
import path from "node:path";
import {
  discoverCollections,
  loadCollectionConfig,
  loadProjectConfig,
  parseContentFile,
  parseFileName,
  resolveConfig,
  serializeContentFile,
} from "@contenz/core/api";
import { globby } from "globby";
import { NextResponse } from "next/server";

type TranslateBody = {
  collection: string;
  slug: string;
  targetLocale: string;
  sourceLocale?: string;
};

export async function POST(request: Request) {
  const cwd = process.env.CONTENZ_PROJECT_ROOT || process.cwd();

  let body: TranslateBody;
  try {
    body = (await request.json()) as TranslateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { collection: collectionName, slug, targetLocale, sourceLocale: sourceLocaleArg } = body;
  if (!collectionName || !slug || !targetLocale) {
    return NextResponse.json(
      { error: "Missing required fields: collection, slug, targetLocale" },
      { status: 400 }
    );
  }

  try {
    const projectConfig = await loadProjectConfig(cwd);
    const baseConfig = resolveConfig(projectConfig);

    if (!baseConfig.i18n) {
      return NextResponse.json({ error: "i18n is not enabled in contenz config" }, { status: 400 });
    }

    const discovery = await discoverCollections(cwd, baseConfig.sources);
    if (discovery.errors.length > 0) {
      return NextResponse.json(
        { error: "Discovery errors", details: discovery.errors },
        { status: 400 }
      );
    }

    const collection = discovery.collections.find((c) => c.name === collectionName);
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const collectionConfig = await loadCollectionConfig(collection.collectionPath);
    const config = resolveConfig(projectConfig, collectionConfig);

    if (!config.i18n) {
      return NextResponse.json(
        { error: "i18n is not enabled for this collection" },
        { status: 400 }
      );
    }

    const ri = config.resolvedI18n;
    const configuredLocales = (ri?.locales?.length ? ri.locales : []) as string[];
    const extensionPattern = config.extensions.map((e) => `*.${e}`).join(",");
    const contentFiles = await globby(`{${extensionPattern}}`, {
      cwd: collection.collectionPath,
      onlyFiles: true,
      ignore: config.ignore,
    });

    const allLocales = new Set<string>();
    for (const file of contentFiles) {
      const parsed = parseFileName(file, config.i18n, config.slugPattern);
      if (parsed?.locale) allLocales.add(parsed.locale);
    }
    const effectiveLocales =
      configuredLocales.length > 0 ? configuredLocales : [...allLocales].sort();

    const sourceLocale = sourceLocaleArg ?? ri?.defaultLocale ?? effectiveLocales[0];
    if (!sourceLocale) {
      return NextResponse.json(
        { error: "No source locale available; set defaultLocale or add content" },
        { status: 400 }
      );
    }

    let sourceFile: string | null = null;
    let ext: "mdx" | "md" = "mdx";
    for (const file of contentFiles) {
      const parsed = parseFileName(file, config.i18n, config.slugPattern);
      if (parsed && parsed.slug === slug && parsed.locale === sourceLocale) {
        sourceFile = file;
        ext = parsed.ext;
        break;
      }
    }

    if (!sourceFile) {
      return NextResponse.json(
        { error: `Source file not found for slug "${slug}" and locale "${sourceLocale}"` },
        { status: 404 }
      );
    }

    const newFileName = `${slug}.${targetLocale}.${ext}`;
    const newFilePath = path.join(collection.collectionPath, newFileName);
    try {
      await fs.access(newFilePath);
      return NextResponse.json({ error: `File already exists: ${newFileName}` }, { status: 409 });
    } catch {
      // File does not exist, proceed
    }

    const sourceFilePath = path.join(collection.collectionPath, sourceFile);
    const parsed = await parseContentFile(sourceFilePath, config);
    const content = serializeContentFile(parsed.meta, parsed.body ?? "", ext);
    await fs.writeFile(newFilePath, content, "utf-8");

    return NextResponse.json({
      file: newFileName,
      slug,
      locale: targetLocale,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
