import { discoverCollections, loadProjectConfig, resolveConfig } from "@contenz/core/api";
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

    return NextResponse.json({
      cwd,
      collections: discovery.collections.map((c) => ({
        name: c.name,
        collectionPath: c.collectionPath,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
