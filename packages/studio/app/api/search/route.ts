import fs from "node:fs/promises";
import path from "node:path";
import {
  discoverCollections,
  loadCollectionConfig,
  loadProjectConfig,
  parseContentFile,
  parseFileName,
  resolveConfig,
} from "@contenz/core/api";
import { globby } from "globby";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cwd = process.env.CONTENZ_PROJECT_ROOT || process.cwd();
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  const term = q.trim().toLowerCase();

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

    const results: {
      collection: string;
      file: string;
      slug: string;
      locale?: string;
      excerpt: string;
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

      for (const file of contentFiles) {
        const parsed = parseFileName(file, config.i18n, config.slugPattern);
        if (!parsed) continue;

        const filePath = path.join(collection.collectionPath, file);
        const raw = await fs.readFile(filePath, "utf-8");
        let parsedContent: { meta: Record<string, unknown> };
        try {
          parsedContent = await parseContentFile(filePath, config);
        } catch {
          continue;
        }

        const metaStr = JSON.stringify(parsedContent.meta).toLowerCase();
        const bodyLower = raw.toLowerCase();
        const inMeta = metaStr.includes(term);
        const inBody = bodyLower.includes(term);

        if (!inMeta && !inBody) continue;

        let excerpt = "";
        if (inBody) {
          const idx = bodyLower.indexOf(term);
          const start = Math.max(0, idx - 60);
          const end = Math.min(raw.length, idx + term.length + 60);
          excerpt = (start > 0 ? "…" : "") + raw.slice(start, end) + (end < raw.length ? "…" : "");
        } else if (inMeta) {
          excerpt = "Match in metadata";
        }

        results.push({
          collection: collection.name,
          file,
          slug: parsed.slug,
          locale: parsed.locale,
          excerpt: excerpt.replace(/\s+/g, " ").trim(),
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
