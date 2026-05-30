import { describe, expect, it } from "vitest";
import { runSkill } from "../run-skill.js";
import { prepareFixture } from "../test-fixtures.js";

describe("runSkill", () => {
  it("generates a SKILL.md for a project", async () => {
    const cwd = await prepareFixture("minimal");
    const result = await runSkill(cwd);
    expect(result.success).toBe(true);

    const md = result.data!;
    expect(md).toContain("name: project-content-model");
    expect(md).toContain("### Collection: `faq`");
    expect(md).toContain("`question`: `string` **(required)**");
    // Array item
    expect(md).toContain("`category`: `enum` **(required)**");
    expect(md).toContain("- Options: `products`, `ordering`");
  });

  it("handles multi-type collections", async () => {
    const cwd = await prepareFixture("multi-type");
    const result = await runSkill(cwd);
    expect(result.success).toBe(true);

    const md = result.data!;
    expect(md).toContain("### Collection: `terms`");
    expect(md).toContain("**Content Type: `term`**");
    expect(md).toContain("**Content Type: `topic`**");
    expect(md).toContain("`term`: `string`");
    expect(md).toContain("`title`: `string`");
    expect(md).toContain("`description`: `string` *(optional)*");
  });
});
