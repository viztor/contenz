import fs from "node:fs/promises";
import path from "node:path";
import {
  discoverCollections,
  extractBodyFromSource,
  getContentType,
  getSchemaForType,
  loadCollectionConfig,
  loadProjectConfig,
  loadSchemaModule,
  parseContentFile,
  parseFileName,
  resolveConfig,
  serializeContentFile,
  validateMeta,
} from "@contenz/core/api";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cwd = process.env.CONTENZ_PROJECT_ROOT || process.cwd();
  const collectionName = request.nextUrl.searchParams.get("collection");
  const fileParam = request.nextUrl.searchParams.get("file");
  if (!collectionName || !fileParam) {
    return NextResponse.json({ error: "Missing collection or file query param" }, { status: 400 });
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

    const filePath = path.join(collection.collectionPath, fileParam);
    const collectionConfig = await loadCollectionConfig(collection.collectionPath);
    const config = resolveConfig(projectConfig, collectionConfig);

    let parsed: {
      meta: Record<string, unknown>;
      body: string;
      slug: string;
      locale: string | null;
    };
    try {
      const result = await parseContentFile(filePath, config);
      parsed = {
        meta: result.meta,
        body: result.body ?? "",
        slug: result.slug,
        locale: result.locale ?? null,
      };
    } catch (parseErr) {
      const raw = await fs.readFile(filePath, "utf-8");
      const fileName = path.basename(filePath);
      const parsedName = parseFileName(fileName, config.i18n, config.slugPattern);
      if (!parsedName) {
        throw parseErr;
      }
      const body = extractBodyFromSource(raw, parsedName.ext);
      parsed = {
        meta: {},
        body: body ?? "",
        slug: parsedName.slug,
        locale: parsedName.locale ?? null,
      };
    }

    const schemaModule = await loadSchemaModule(collection.collectionPath);
    let validation: { valid: boolean; errors: { field: string; message: string }[] } = {
      valid: true,
      errors: [],
    };

    if (schemaModule) {
      const rawSchema = schemaModule.meta || (schemaModule as Record<string, unknown>).metaSchema;
      if (rawSchema && typeof rawSchema === "object" && "_def" in rawSchema) {
        const contentType = getContentType(fileParam, config);
        const schema = getSchemaForType(schemaModule, contentType);
        if (schema) {
          const result = validateMeta(parsed.meta, schema as import("zod").ZodSchema, fileParam);
          validation = {
            valid: result.valid,
            errors: result.errors.map((e) => ({ field: e.field, message: e.message })),
          };
        }
      }
    }

    return NextResponse.json({
      meta: parsed.meta,
      body: parsed.body ?? "",
      slug: parsed.slug,
      locale: parsed.locale ?? null,
      validation,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const cwd = process.env.CONTENZ_PROJECT_ROOT || process.cwd();
  const collectionName = request.nextUrl.searchParams.get("collection");
  const fileParam = request.nextUrl.searchParams.get("file");
  if (!collectionName || !fileParam) {
    return NextResponse.json({ error: "Missing collection or file query param" }, { status: 400 });
  }

  let body: { meta?: Record<string, unknown>; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const meta = body.meta ?? {};
  const contentBody = typeof body.body === "string" ? body.body : "";

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

    const filePath = path.join(collection.collectionPath, fileParam);
    const collectionConfig = await loadCollectionConfig(collection.collectionPath);
    const config = resolveConfig(projectConfig, collectionConfig);
    const schemaModule = await loadSchemaModule(collection.collectionPath);

    if (schemaModule) {
      const rawSchema = schemaModule.meta || (schemaModule as Record<string, unknown>).metaSchema;
      if (rawSchema && typeof rawSchema === "object" && "_def" in rawSchema) {
        const contentType = getContentType(fileParam, config);
        const schema = getSchemaForType(schemaModule, contentType);
        if (schema) {
          const result = validateMeta(meta, schema as import("zod").ZodSchema, fileParam);
          if (!result.valid) {
            return NextResponse.json(
              {
                error: "Validation failed",
                validation: {
                  valid: false,
                  errors: result.errors.map((e) => ({ field: e.field, message: e.message })),
                },
              },
              { status: 400 }
            );
          }
        }
      }
    }

    const ext = fileParam.endsWith(".mdx") ? "mdx" : "md";
    const output = serializeContentFile(meta, contentBody, ext);
    await fs.writeFile(filePath, output, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
