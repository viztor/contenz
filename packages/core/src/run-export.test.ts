import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  collectEntryUnits,
  escapeXml,
  flattenToStrings,
  runExport,
  unitId,
} from "./run-export.js";
import { prepareFixture } from "./test-fixtures.js";

describe("flattenToStrings", () => {
  it("flattens nested objects with sorted dotted paths", () => {
    expect(
      flattenToStrings({ b: "two", a: { c: "one", d: ["x", "y"] } }, "")
    ).toEqual([
      { path: "a.c", value: "one" },
      { path: "a.d.0", value: "x" },
      { path: "a.d.1", value: "y" },
      { path: "b", value: "two" },
    ]);
  });

  it("skips non-strings and empties", () => {
    expect(
      flattenToStrings({ n: 42, b: true, e: "", z: null, s: "ok" }, "")
    ).toEqual([{ path: "s", value: "ok" }]);
  });
});

describe("escapeXml", () => {
  it("escapes markup and strips illegal chars", () => {
    expect(escapeXml('<a href="x">&\'енью')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&apos;енью"
    );
    expect(escapeXml("a\u0001b")).toBe("ab");
  });
});

describe("collectEntryUnits", () => {
  it("emits meta leaves plus body with stable ids", () => {
    const units = collectEntryUnits({
      collection: "faq",
      slug: "moq",
      file: "moq.en.json",
      locale: "en",
      meta: { question: "Q?", tags: ["a"] },
      body: "Hello",
    });
    expect(units.map((u) => unitId(u))).toEqual([
      "faq.moq.question",
      "faq.moq.tags.0",
      "faq.moq.body",
    ]);
  });

  it("skips empty bodies", () => {
    const units = collectEntryUnits({
      collection: "faq",
      slug: "moq",
      file: "moq.en.json",
      locale: "en",
      meta: { question: "Q?" },
      body: "   ",
    });
    expect(units.map((u) => unitId(u))).toEqual(["faq.moq.question"]);
  });
});

describe("runExport", () => {
  it("emits per-locale messages.json", async () => {
    const cwd = await prepareFixture("singles");
    const result = await runExport({ cwd, format: "messages" });

    expect(result.success).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.files.sort()).toEqual([
      path.join("messages", "en.json"),
      path.join("messages", "zh.json"),
    ]);

    const en = JSON.parse(
      await fs.readFile(path.join(cwd, "messages", "en.json"), "utf-8")
    ) as Record<string, string>;
    expect(en["faq.hello.question"]).toBe(
      "What is the minimum order quantity?"
    );
    expect(en["site.site.title"]).toBe("Example Site");

    const zh = JSON.parse(
      await fs.readFile(path.join(cwd, "messages", "zh.json"), "utf-8")
    ) as Record<string, string>;
    expect(zh["faq.hello.question"]).toBe("最低起订量是多少？");
    // motto has no zh file: absent, not empty.
    expect("motto.motto.text" in zh).toBe(false);
  });

  it("emits XLIFF per target locale with source/target pairs", async () => {
    const cwd = await prepareFixture("singles");
    const result = await runExport({ cwd, format: "xliff" });

    expect(result.success).toBe(true);
    expect(result.files).toEqual([path.join("xliff", "zh.xlf")]);

    const xlf = await fs.readFile(path.join(cwd, "xliff", "zh.xlf"), "utf-8");
    expect(xlf).toContain('source-language="en"');
    expect(xlf).toContain('target-language="zh"');
    expect(xlf).toContain('id="faq.hello.question"');
    expect(xlf).toContain(
      "<source>What is the minimum order quantity?</source>"
    );
    expect(xlf).toContain("<target>最低起订量是多少？</target>");
    expect(xlf).toContain("<note>file: hello.");
  });

  it("respects collection and locale filters", async () => {
    const cwd = await prepareFixture("singles");
    const result = await runExport({
      cwd,
      format: "messages",
      collection: "site",
      locale: "zh",
      outDir: "msgs",
    });

    expect(result.success).toBe(true);
    expect(result.files).toEqual([path.join("msgs", "zh.json")]);
    const zh = JSON.parse(
      await fs.readFile(path.join(cwd, "msgs", "zh.json"), "utf-8")
    ) as Record<string, string>;
    expect(Object.keys(zh).sort()).toEqual([
      "site.site.description",
      "site.site.title",
    ]);
  });

  it("warns and assumes en for locale-less files without default", async () => {
    const cwd = await prepareFixture("minimal");
    const result = await runExport({ cwd, format: "messages" });

    expect(result.success).toBe(true);
    expect(
      result.diagnostics.some((d) => d.code === "EXPORT_LOCALE_ASSUMED")
    ).toBe(true);
    expect(result.files).toEqual([path.join("messages", "en.json")]);
  });

  it("errors on unknown collections", async () => {
    const cwd = await prepareFixture("singles");
    const result = await runExport({ cwd, collection: "nope" });

    expect(result.success).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.files).toEqual([]);
  });
});
