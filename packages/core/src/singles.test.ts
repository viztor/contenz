import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runCreate } from "./ops/create.js";
import { runList } from "./ops/list.js";
import { runUpdate } from "./ops/update.js";
import { runView } from "./ops/view.js";
import { createReader } from "./reader.js";
import { runBuild } from "./run-build.js";
import { runLint } from "./run-lint.js";
import { runSchema } from "./run-schema.js";
import { runSearch } from "./run-search.js";
import { nodeStorage } from "./storage-node.js";
import { prepareFixture } from "./test-fixtures.js";
import { createWorkspace } from "./workspace.js";

async function useFixture(): Promise<string> {
  return prepareFixture("singles");
}

function readerFor(cwd: string) {
  return createReader(
    {
      collections: [{ name: "faq", dir: "content/faq" }],
      singles: [
        { name: "site", path: "data/site.en.json" },
        { name: "motto", path: "data/motto.en.json" },
      ],
      i18n: {
        enabled: true,
        defaultLocale: "en",
        locales: ["en", "zh"],
      },
    },
    nodeStorage({ root: cwd })
  );
}

describe("singles: workspace", () => {
  it("loads declared singles with variant files and schemas", async () => {
    const cwd = await useFixture();
    const ws = await createWorkspace({ cwd });

    expect(ws.collections.map((c) => c.name)).toEqual(["faq"]);
    expect(ws.singles.map((c) => c.name)).toEqual(["motto", "site"]);

    const site = ws.getSingle("site")!;
    expect(site.kind).toBe("single");
    expect(site.contentFiles.sort()).toEqual(["site.en.json", "site.zh.json"]);
    expect(site.schema?.meta).toBeDefined();

    const motto = ws.getSingle("motto")!;
    expect(motto.schema).toBeNull();

    expect(ws.getCollection("site")).toBeUndefined();
  });

  it("rejects types/slugPattern on singles", async () => {
    const dir = await fs.mkdtemp(os.tmpdir() + "/contenz-singles-");
    await fs.mkdir(path.join(dir, "data"), { recursive: true });
    await fs.writeFile(
      path.join(dir, "data", "site.en.json"),
      JSON.stringify({ title: "x" })
    );
    await fs.writeFile(
      path.join(dir, "contenz.config.ts"),
      `export const config = { singles: { site: { path: "data/site.en.json", config: { types: [{ name: "x", pattern: /.*/ }] } } } };\n`
    );
    await expect(createWorkspace({ cwd: dir })).rejects.toThrow(
      'Single "site" must not define types or slugPattern'
    );
  });

  it("reports missing single files as discovery errors", async () => {
    const cwd = await useFixture();
    await fs.rm(path.join(cwd, "data", "site.en.json"));
    await fs.rm(path.join(cwd, "data", "site.zh.json"));
    const ws = await createWorkspace({ cwd });
    expect(ws.discoveryErrors.some((e) => e.includes('Single "site"'))).toBe(
      true
    );
  });
});

describe("singles: build", () => {
  it("emits collection-shaped .ts/.json for singles and manifest entries", async () => {
    const cwd = await useFixture();
    const result = await runBuild({ cwd });

    expect(result.success).toBe(true);
    expect(result.generated).toContain("site.ts");
    expect(result.generated).toContain("site.json");
    expect(result.generated).toContain("motto.json");
    expect(
      result.diagnostics.some((d) => d.code === "SINGLE_UNVALIDATED")
    ).toBe(true);

    const siteJson = JSON.parse(
      await fs.readFile(
        path.join(cwd, "generated", "content", "site.json"),
        "utf-8"
      )
    ) as Record<
      string,
      { slug: string; locales: Record<string, { title: string }> }
    >;
    expect(Object.keys(siteJson)).toEqual(["site"]);
    expect(siteJson.site.slug).toBe("site");
    expect(siteJson.site.locales.en.title).toBe("Example Site");
    expect(siteJson.site.locales.zh.title).toBe("示例网站");

    const manifest = JSON.parse(
      await fs.readFile(
        path.join(cwd, "generated", "content", "manifest.json"),
        "utf-8"
      )
    ) as {
      collections: Record<
        string,
        { file: string; slugs: string[]; locales?: string[] }
      >;
    };
    expect(manifest.collections.site).toMatchObject({
      file: "site.json",
      slugs: ["site"],
      locales: ["en", "zh"],
    });
    expect(manifest.collections.faq.slugs).toEqual(["hello"]);
  });
});

describe("singles: lint", () => {
  it("validates singles and includes them in coverage", async () => {
    const cwd = await useFixture();
    const result = await runLint({ cwd, coverage: true });

    expect(result.errors).toBe(0);
    expect(
      result.diagnostics.some((d) => d.code === "SINGLE_UNVALIDATED")
    ).toBe(true);

    const coverage = await fs.readFile(
      path.join(cwd, "contenz.coverage.md"),
      "utf-8"
    );
    expect(coverage).toContain("site");
    expect(coverage).toContain("motto");
  });
});

describe("singles: reader", () => {
  it("reads singles by name with locale fallback semantics", async () => {
    const cwd = await useFixture();
    const reader = readerFor(cwd);

    const en = await reader.singles.site.read("en");
    expect(en).toMatchObject({
      slug: "site",
      locale: "en",
      file: "data/site.en.json",
    });
    expect(en!.meta).toMatchObject({ title: "Example Site" });

    const def = await reader.singles.site.read();
    expect(def?.locale).toBe("en");

    const zh = await reader.singles.site.read("zh");
    expect(zh?.meta).toMatchObject({ title: "示例网站" });

    // No fallback chain configured: unknown locale misses.
    expect(await reader.singles.site.read("fr")).toBeNull();
    await expect(reader.singles.site.readOrThrow("fr")).rejects.toThrow(
      'Single "site"'
    );

    const motto = await reader.singles.motto.read("en");
    expect(motto?.meta).toMatchObject({ text: "Ship small, ship often." });
  });

  it("throws for unknown singles", async () => {
    const cwd = await useFixture();
    const reader = readerFor(cwd);
    expect(() => reader.singles.nope).toThrow("Single not found: nope");
  });
});

describe("singles: ops", () => {
  it("lists singles alongside collections", async () => {
    const cwd = await useFixture();
    const result = await runList({ cwd });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect("singles" in result.data).toBe(true);
    const data = result.data as {
      collections: { name: string }[];
      singles: { name: string }[];
    };
    expect(data.collections.map((c) => c.name)).toEqual(["faq"]);
    expect(data.singles.map((c) => c.name)).toEqual(["motto", "site"]);
  });

  it("lists locale variants for a single", async () => {
    const cwd = await useFixture();
    const result = await runList({ cwd, collection: "site" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as {
      collection: string;
      items: { slug: string; locale: string | null }[];
    };
    expect(data.collection).toBe("site");
    expect(data.items).toEqual([
      expect.objectContaining({ slug: "site", locale: "en" }),
      expect.objectContaining({ slug: "site", locale: "zh" }),
    ]);
  });

  it("views a single without a slug", async () => {
    const cwd = await useFixture();
    const result = await runView({ cwd, collection: "site", locale: "zh" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.slug).toBe("site");
    expect(result.data.meta).toMatchObject({ title: "示例网站" });
  });

  it("requires a slug for collections", async () => {
    const cwd = await useFixture();
    const result = await runView({ cwd, collection: "faq" });
    expect(result.success).toBe(false);
  });

  it("rejects create on singles", async () => {
    const cwd = await useFixture();
    const result = await runCreate({
      cwd,
      collection: "site",
      slug: "site",
      meta: { title: "x" },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Cannot create entries in single");
  });

  it("updates a single in place", async () => {
    const cwd = await useFixture();
    const result = await runUpdate({
      cwd,
      collection: "site",
      set: { title: "Renamed" },
      locale: "en",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.slug).toBe("site");
    const view = await runView({ cwd, collection: "site", locale: "en" });
    expect(view.success && view.data.meta).toMatchObject({ title: "Renamed" });
  });

  it("searches and introspects singles", async () => {
    const cwd = await useFixture();
    const search = await runSearch({ cwd, collection: "site" });
    expect(search.success).toBe(true);
    if (!search.success) return;
    expect(search.data.items.length).toBeGreaterThan(0);
    expect(search.data.items[0].slug).toBe("site");

    const schema = await runSchema({ cwd, collection: "site" });
    expect(schema.success).toBe(true);

    const schemaless = await runSchema({ cwd, collection: "motto" });
    expect(schemaless.success).toBe(false);
  });
});
