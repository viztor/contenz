import {
  discoverCollections,
  loadCollectionConfig,
  loadProjectConfig,
  parseFileName,
  resolveConfig,
} from "@contenz/core/api";
import { globby } from "globby";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cwd = process.env.CONTENZ_PROJECT_ROOT || process.cwd();
  const collectionName = request.nextUrl.searchParams.get("collection");
  if (!collectionName) {
    return NextResponse.json({ error: "Missing collection query param" }, { status: 400 });
  }

  try {
    const projectConfig = await loadProjectConfig(cwd);
    const baseConfig = resolveConfig(projectConfig);
    const discovery = await discoverCollections(cwd, baseConfig.sources);
    const collection = discovery.collections.find((c) => c.name === collectionName);
    if (!collection) {
      return NextResponse.json(
        { error: `Collection "${collectionName}" not found` },
        { status: 404 }
      );
    }

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

    return NextResponse.json({ collection: collectionName, documents });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
