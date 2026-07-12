import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { writeContent } from "../content-io.js";
import { prepareFixture } from "../test-fixtures.js";

describe("writeContent", () => {
  it("prevents path traversal outside of collection directory", async () => {
    const cwd = await prepareFixture("minimal");

    // We expect this to throw
    await expect(
      writeContent({
        cwd,
        collectionName: "faq",
        slug: "../../../malicious",
        meta: {},
        body: "PWNED",
      })
    ).rejects.toThrow("Invalid slug: path traversal detected");

    // And double check the file isn't there
    const exists = await fs
      .stat(path.join(cwd, "malicious.mdx"))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });
});
