import {
  discoverCollections,
  loadCollectionConfig,
  loadProjectConfig,
  parseFileName,
  resolveConfig,
} from "@contenz/core/api";
import { globby } from "globby";
import { NextResponse } from "next/server";

export async function GET() {
  const cwd = process.env.CONTENZ_PROJECT_ROOT || process.cwd();

  try {
    const projectConfig = await loadProjectConfig(cwd);
    const baseConfig = resolveConfig(projectConfig);
    const discovery = await discoverCollections(cwd, baseConfig.sources);

    if (discovery.errors.length > 0) {
      return NextResponse.json(
        { error: "Discovery errors", details: discovery.errors },
        { status: 400 }
      );
    }

    const collections: {
      name: string;
      documents: { file: string; slug: string; locale?: string }[];
    }[] = [];

    for (const collection of discovery.collections) {
      const collectionConfig = await loadCollectionConfig(collection.collectionPath);
      const config = resolveConfig(projectConfig, collectionConfig);
      const extensionPattern = config.extensions.map((e) => `*.${e}`).join(",");
      const contentFiles = await globby(`{${extensionPattern}}`, {
        cwd: collection.collectionPath,
        onlyFiles: true,
        ignore: config.ignore,
      });

      const documents: { slug: string; file: string; locale?: string }[] = [];
      for (const file of contentFiles.sort()) {
        const parsed = parseFileName(file, config.i18n, config.slugPattern);
        if (parsed) {
          documents.push({
            slug: parsed.slug,
            file,
            locale: parsed.locale,
          });
        }
      }
      collections.push({ name: collection.name, documents });
    }

    return NextResponse.json({ cwd, collections });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
