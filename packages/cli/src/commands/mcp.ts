/**
 * `contenz mcp` — serve the Contenz MCP server over stdio.
 *
 * Exposes collections, entries, search, schema, lint, and status as
 * read-only tools by default; create/update/build require `--allow-write`.
 * Nothing but the MCP protocol is written to stdout (use stderr for logs).
 */
import path from "node:path";

import {
  loadProjectConfig,
  normalizeI18nConfig,
  runBuild,
  runCreate,
  runLint,
  runList,
  runSchema,
  runSearch,
  runStatus,
  runUpdate,
  runView,
} from "@contenz/core/api";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildCommand } from "@stricli/core";
import { z } from "zod";

import type { ContenzContext } from "../context.js";
import { cwdFlag } from "../shared.js";

// Build-time constant (tsup `define`); resilient when imported from source
// (vitest) where the define does not apply.
declare const __CONTENZ_CLI_VERSION__: string;
const CLI_VERSION =
  ((globalThis as Record<string, unknown>).__CONTENZ_CLI_VERSION__ as
    | string
    | undefined) ?? "0.0.0";

interface McpFlags {
  cwd: string;
  allowWrite: boolean;
}

export interface McpServerOptions {
  cwd: string;
  allowWrite: boolean;
  version?: string;
}

/**
 * Strip non-JSON-safe values (functions, Zod schemas, RegExps) from the
 * project config for the `contenz://config` resource.
 */
export function sanitizeConfigForJson(value: unknown): unknown {
  if (typeof value === "function") return "[function]";
  if (value instanceof RegExp) return String(value);
  if (Array.isArray(value)) return value.map(sanitizeConfigForJson);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    // Zod schemas (v3 `._def`, v4 `.def`) collapse to a type marker.
    for (const key of ["_def", "def"]) {
      const def = record[key];
      if (def && typeof def === "object") {
        const marker =
          (def as Record<string, unknown>).typeName ??
          (def as Record<string, unknown>).type;
        if (typeof marker === "string") {
          return `[zod:${marker}]`;
        }
      }
    }
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      out[key] = sanitizeConfigForJson(entry);
    }
    return out;
  }
  return value;
}

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function needsWrite(allowWrite: boolean) {
  return allowWrite
    ? null
    : errorResult("Writing requires starting the server with --allow-write.");
}

export function buildMcpServer(options: McpServerOptions): McpServer {
  const { cwd, allowWrite } = options;
  const server = new McpServer({
    name: "contenz",
    version: options.version ?? CLI_VERSION,
  });

  // ── Reads ─────────────────────────────────────────────────────────────

  server.registerTool(
    "contenz_list",
    {
      description:
        "List collections and singles, or items within one collection/single.",
      inputSchema: {
        collection: z
          .string()
          .optional()
          .describe("Collection or single name; omit to list all."),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      textResult(await runList({ cwd, collection: args.collection }))
  );

  server.registerTool(
    "contenz_view",
    {
      description:
        "Read one content item. Omit slug only for singles (defaults to the name).",
      inputSchema: {
        collection: z.string().describe("Collection or single name."),
        slug: z.string().optional().describe("Content slug."),
        locale: z.string().optional().describe("Locale (i18n collections)."),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      textResult(
        await runView({
          cwd,
          collection: args.collection,
          slug: args.slug,
          locale: args.locale,
        })
      )
  );

  server.registerTool(
    "contenz_search",
    {
      description: "Search items by slug substring and/or meta field values.",
      inputSchema: {
        collection: z.string().describe("Collection or single name."),
        query: z.string().optional().describe("Slug substring match."),
        fields: z
          .record(z.string(), z.string())
          .optional()
          .describe("Meta field-value filters."),
        locale: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      textResult(
        await runSearch({
          cwd,
          collection: args.collection,
          query: args.query,
          fields: args.fields,
          locale: args.locale,
          limit: args.limit,
        })
      )
  );

  server.registerTool(
    "contenz_schema",
    {
      description:
        "Introspect a collection/single schema: fields, types, relations.",
      inputSchema: {
        collection: z.string().describe("Collection or single name."),
        contentType: z
          .string()
          .optional()
          .describe("Content type (multi-type collections)."),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      textResult(
        await runSchema({
          cwd,
          collection: args.collection,
          contentType: args.contentType,
        })
      )
  );

  server.registerTool(
    "contenz_lint",
    {
      description:
        "Validate content (schemas, relations, translations). Returns diagnostics.",
      inputSchema: {
        collection: z.string().optional(),
        coverage: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const result = await runLint({
        cwd,
        collection: args.collection,
        coverage: args.coverage,
      });
      return textResult({
        success: result.success,
        errors: result.errors,
        diagnostics: result.diagnostics,
      });
    }
  );

  server.registerTool(
    "contenz_status",
    {
      description: "Check whether the build output is up to date.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => textResult(await runStatus({ cwd }))
  );

  // ── Writes (gated) ────────────────────────────────────────────────────

  server.registerTool(
    "contenz_create",
    {
      description:
        "Create a content item (fills schema defaults, validates). Rejected for singles.",
      inputSchema: {
        collection: z.string(),
        slug: z.string(),
        metaJson: z.string().describe("New item meta as a JSON object string."),
        locale: z.string().optional(),
      },
      annotations: { destructiveHint: true },
    },
    async (args) => {
      const gate = needsWrite(allowWrite);
      if (gate) return gate;
      let meta: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(args.metaJson);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("must be a JSON object");
        }
        meta = parsed as Record<string, unknown>;
      } catch (error) {
        return errorResult(
          `metaJson must be a JSON object string: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return textResult(
        await runCreate({
          cwd,
          collection: args.collection,
          slug: args.slug,
          meta,
          locale: args.locale,
        })
      );
    }
  );

  server.registerTool(
    "contenz_update",
    {
      description:
        "Surgically update fields on an item (validates merged state).",
      inputSchema: {
        collection: z.string(),
        slug: z.string().optional().describe("Omit only for singles."),
        setJson: z
          .string()
          .optional()
          .describe("Fields to set as a JSON object string."),
        unset: z.array(z.string()).optional().describe("Fields to remove."),
        locale: z.string().optional(),
      },
      annotations: { destructiveHint: true },
    },
    async (args) => {
      const gate = needsWrite(allowWrite);
      if (gate) return gate;
      let set: Record<string, unknown> | undefined;
      if (args.setJson !== undefined) {
        try {
          const parsed: unknown = JSON.parse(args.setJson);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("must be a JSON object");
          }
          set = parsed as Record<string, unknown>;
        } catch (error) {
          return errorResult(
            `setJson must be a JSON object string: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      return textResult(
        await runUpdate({
          cwd,
          collection: args.collection,
          slug: args.slug,
          set,
          unset: args.unset,
          locale: args.locale,
        })
      );
    }
  );

  server.registerTool(
    "contenz_build",
    {
      description: "Rebuild generated output (TypeScript + JSON + manifest).",
      inputSchema: {
        force: z.boolean().optional().describe("Rebuild all, ignore cache."),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const gate = needsWrite(allowWrite);
      if (gate) return gate;
      const result = await runBuild({ cwd, force: args.force });
      return textResult({
        success: result.success,
        errors: result.errors,
        generated: result.generated,
        diagnostics: result.diagnostics,
      });
    }
  );

  // ── Resources ─────────────────────────────────────────────────────────

  server.registerResource(
    "config",
    "contenz://config",
    {
      title: "Contenz project config",
      description: "Sanitized contenz.config (functions/schemas abbreviated).",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            sanitizeConfigForJson(await loadProjectConfig(cwd)),
            null,
            2
          ),
        },
      ],
    })
  );

  server.registerResource(
    "collections",
    "contenz://collections",
    {
      title: "Collections and singles",
      description: "Names, paths, item counts, and fields.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await runList({ cwd }), null, 2),
        },
      ],
    })
  );

  // ── Prompts ───────────────────────────────────────────────────────────

  server.registerPrompt(
    "new_entry",
    {
      title: "Draft a new content entry",
      description: "Schema-aware drafting guidance for one collection item.",
      argsSchema: {
        collection: z.string(),
        slug: z.string(),
        brief: z.string().optional(),
      },
    },
    async (args) => {
      const schema = await runSchema({
        cwd,
        collection: args.collection,
      });
      const brief = args.brief ? `\nBrief: ${args.brief}` : "";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Draft a new "${args.collection}" entry with slug "${args.slug}".${brief}`,
                "Use contenz_schema first if you have not seen the schema; then contenz_create (needs --allow-write) or present the files.",
                `Schema context: ${JSON.stringify(schema)}`,
              ].join("\n"),
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    "translate_missing",
    {
      title: "Fill missing translations",
      description: "Find slugs missing a locale and draft them.",
      argsSchema: {
        collection: z.string(),
        locale: z.string(),
      },
    },
    async (args) => {
      const listed = await runList({ cwd, collection: args.collection });
      const gaps: string[] = [];
      if (listed.success) {
        const data = listed.data as {
          items?: { slug: string; locale: string | null }[];
        };
        const bySlug = new Map<string, Set<string>>();
        for (const item of data.items ?? []) {
          const set = bySlug.get(item.slug) ?? new Set<string>();
          if (item.locale) set.add(item.locale);
          bySlug.set(item.slug, set);
        }
        for (const [slug, locales] of bySlug) {
          if (!locales.has(args.locale)) gaps.push(slug);
        }
      }
      // Declared locales come from project config when available.
      let declared: string[] = [];
      try {
        const project = await loadProjectConfig(cwd);
        declared = normalizeI18nConfig(project.i18n).locales;
      } catch {
        // Fall back to detected locales only.
      }
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Translate collection "${args.collection}" into "${args.locale}".`,
                declared.length > 0
                  ? `Declared locales: ${declared.join(", ")}.`
                  : null,
                gaps.length > 0
                  ? `Slugs missing "${args.locale}": ${gaps.join(", ")}.`
                  : `No gaps detected for "${args.locale}" (check fallback coverage with contenz_lint).`,
                "Read each default-locale item with contenz_view, then write the translation with contenz_update + --locale (needs --allow-write).",
              ]
                .filter((line): line is string => line !== null)
                .join("\n"),
            },
          },
        ],
      };
    }
  );

  return server;
}

async function mcp(this: ContenzContext, flags: McpFlags): Promise<void> {
  const cwd = path.resolve(this.process.cwd(), flags.cwd);
  const server = buildMcpServer({
    cwd,
    allowWrite: flags.allowWrite,
    version: CLI_VERSION,
  });
  await server.connect(new StdioServerTransport());
}

export const mcpCommandDef = buildCommand({
  func: mcp,
  parameters: {
    flags: {
      cwd: cwdFlag,
      allowWrite: {
        kind: "boolean",
        brief: "Enable write tools (create/update/build). Default off.",
        default: false,
      },
    },
  },
  docs: {
    brief: "Serve the Contenz MCP server over stdio",
    fullDescription:
      "Exposes collections, entries, search, schema, lint, and status as read-only tools. Pass --allow-write to enable create/update/build. Configure in .mcp.json or Claude Code.",
  },
});
