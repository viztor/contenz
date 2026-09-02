import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  /**
   * Obsidian markdown compat (docs/ follows ~/dev/OBSIDIAN.md):
   * - proseWrap "preserve": ultracite's "never" joins callout body lines
   *   (`> [!note] Title` + body) into one line, which breaks callout rendering.
   * - Wikilinks inside GFM tables must use the escaped pipe `[[X\|Y]]`
   *   (Obsidian's own requirement); unescaped `|` is read as a column divider.
   */
  proseWrap: "preserve",
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "**/dist/**",
    "**/coverage/**",
    "**/.turbo/**",
    "packages/e2e/fixtures/**",
  ],
});
