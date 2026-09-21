/**
 * MCP server protocol tests: real client handshake over stdio against the
 * built `contenz mcp` binary, using a tmp copy of the singles fixture so
 * write tools never pollute the repo.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  binPath,
  coreRoot,
  ensureSymlink,
  fixture,
  resolveZodRoot,
} from "./setup.js";

let tmpCwd = "";

function textOf(result: unknown): string {
  const content = (result as { content: { text?: string }[] }).content;
  return content[0]?.text ?? "";
}

function jsonOf<T>(result: unknown): T {
  return JSON.parse(textOf(result)) as T;
}

async function startServer(extraArgs: string[] = []) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [binPath, "mcp", "--cwd", tmpCwd, ...extraArgs],
    stderr: "pipe",
  });
  const client = new Client({ name: "contenz-e2e", version: "0.0.0" });
  await client.connect(transport);
  return {
    client,
    close: async () => {
      await client.close();
    },
  };
}

beforeAll(() => {
  tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), "contenz-mcp-"));
  fs.cpSync(fixture("singles"), tmpCwd, { recursive: true });
  ensureSymlink(tmpCwd, "@contenz/core", coreRoot);
  ensureSymlink(tmpCwd, "zod", resolveZodRoot());
}, 60_000);

afterAll(() => {
  fs.rmSync(tmpCwd, { recursive: true, force: true });
});

describe("mcp: protocol surface", () => {
  it("lists all tools", async () => {
    const { client, close } = await startServer();
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual(
        [
          "contenz_build",
          "contenz_create",
          "contenz_lint",
          "contenz_list",
          "contenz_schema",
          "contenz_search",
          "contenz_status",
          "contenz_update",
          "contenz_view",
        ].sort()
      );
    } finally {
      await close();
    }
  }, 60_000);

  it("reads collections, singles, search, schema, lint, status", async () => {
    const { client, close } = await startServer();
    try {
      const listed = jsonOf<{
        success: boolean;
        data: { collections: { name: string }[]; singles: { name: string }[] };
      }>(await client.callTool({ name: "contenz_list", arguments: {} }));
      expect(listed.success).toBe(true);
      expect(listed.data.collections.map((c) => c.name)).toContain("faq");
      expect(listed.data.singles.map((c) => c.name)).toContain("site");

      const viewed = jsonOf<{
        success: boolean;
        data: { slug: string; meta: Record<string, unknown> };
      }>(
        await client.callTool({
          name: "contenz_view",
          arguments: { collection: "site" },
        })
      );
      expect(viewed.success).toBe(true);
      expect(viewed.data.slug).toBe("site");

      const searched = jsonOf<{ success: boolean; data: { total: number } }>(
        await client.callTool({
          name: "contenz_search",
          arguments: { collection: "faq", query: "hello" },
        })
      );
      expect(searched.success).toBe(true);
      expect(searched.data.total).toBeGreaterThan(0);

      const schemed = jsonOf<{ success: boolean }>(
        await client.callTool({
          name: "contenz_schema",
          arguments: { collection: "faq" },
        })
      );
      expect(schemed.success).toBe(true);

      const linted = jsonOf<{ success: boolean; errors: number }>(
        await client.callTool({ name: "contenz_lint", arguments: {} })
      );
      expect(linted.success).toBe(true);
      expect(linted.errors).toBe(0);

      const status = jsonOf<{ status: string }>(
        await client.callTool({ name: "contenz_status", arguments: {} })
      );
      expect(typeof status.status).toBe("string");
    } finally {
      await close();
    }
  }, 90_000);

  it("serves sanitized config and collections resources", async () => {
    const { client, close } = await startServer();
    try {
      const { resources } = await client.listResources();
      const uris = resources.map((r) => r.uri).sort();
      expect(uris).toEqual(["contenz://collections", "contenz://config"]);

      const config = await client.readResource({ uri: "contenz://config" });
      const text = (config.contents[0] as { text?: string }).text ?? "";
      expect(text).toContain("[zod:");
      expect(text).not.toContain("_def");
    } finally {
      await close();
    }
  }, 60_000);

  it("serves prompts", async () => {
    const { client, close } = await startServer();
    try {
      const { prompts } = await client.listPrompts();
      expect(promptNames(prompts)).toContain("new_entry");
      expect(promptNames(prompts)).toContain("translate_missing");

      const prompt = await client.getPrompt({
        name: "new_entry",
        arguments: { collection: "faq", slug: "hello" },
      });
      const first = prompt.messages[0];
      const text =
        typeof first?.content === "object" &&
        first.content !== null &&
        "text" in first.content
          ? String((first.content as { text: unknown }).text)
          : "";
      expect(text).toContain("faq");

      const missing = await client.getPrompt({
        name: "translate_missing",
        arguments: { collection: "faq", locale: "zh" },
      });
      expect(missing.messages.length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  }, 60_000);

  it("refuses writes without --allow-write", async () => {
    const { client, close } = await startServer();
    try {
      const result = (await client.callTool({
        name: "contenz_create",
        arguments: {
          collection: "faq",
          slug: "nope",
          metaJson: JSON.stringify({ question: "Q?" }),
        },
      })) as { isError?: boolean; content: { text?: string }[] };
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text ?? "").toContain("--allow-write");
      expect(
        fs.existsSync(path.join(tmpCwd, "content", "faq", "nope.en.json"))
      ).toBe(false);
    } finally {
      await close();
    }
  }, 60_000);

  it("writes end to end with --allow-write", async () => {
    const { client, close } = await startServer(["--allow-write"]);
    try {
      const created = jsonOf<{ success: boolean; data: { file: string } }>(
        await client.callTool({
          name: "contenz_create",
          arguments: {
            collection: "faq",
            slug: "mcp-probe",
            metaJson: JSON.stringify({
              question: "Probe?",
              category: "products",
            }),
            locale: "en",
          },
        })
      );
      expect(created.success).toBe(true);

      const updated = jsonOf<{ success: boolean }>(
        await client.callTool({
          name: "contenz_update",
          arguments: {
            collection: "faq",
            slug: "mcp-probe",
            setJson: JSON.stringify({ question: "Probed?" }),
            locale: "en",
          },
        })
      );
      expect(updated.success).toBe(true);

      const viewed = jsonOf<{
        success: boolean;
        data: { meta: Record<string, unknown> };
      }>(
        await client.callTool({
          name: "contenz_view",
          arguments: {
            collection: "faq",
            slug: "mcp-probe",
            locale: "en",
          },
        })
      );
      expect(viewed.data.meta).toMatchObject({ question: "Probed?" });

      const built = jsonOf<{ success: boolean }>(
        await client.callTool({ name: "contenz_build", arguments: {} })
      );
      expect(built.success).toBe(true);
    } finally {
      await close();
    }
    fs.rmSync(path.join(tmpCwd, "content", "faq", "mcp-probe.en.json"), {
      force: true,
    });
  }, 120_000);
});

function promptNames(prompts: { name: string }[]): string[] {
  return prompts.map((p) => p.name);
}
