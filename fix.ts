import fs from "fs";

let content = fs.readFileSync("packages/core/src/run-search.ts", "utf-8");
content = content.replace(
  /for \(const file of col.contentFiles.sort\(\)\) \{([\s\S]*?) {4}if \(items.length >= limit\) break;\n  \}/,
  `const rawResults = await Promise.all(col.contentFiles.sort().map(async (file: string) => {
    const parsed = parseFileName(file, col.config.i18n, col.config.slugPattern);
    if (!parsed) return null;

    // Locale filter
    if (opts.locale && parsed.locale && parsed.locale !== opts.locale) return null;

    // Slug substring filter
    if (opts.query && !parsed.slug.includes(opts.query)) return null;

    // Parse content (needed for meta regardless of field filters)
    const filePath = path.join(col.collectionPath, file);
    const content = await parseContentFile(filePath, col.config);

    // Field-value filter
    if (opts.fields && Object.keys(opts.fields).length > 0) {
      const matches = Object.entries(opts.fields).every(
        ([field, expected]) =>
          content.meta[field] !== undefined &&
          String(content.meta[field]) === expected
      );
      if (!matches) return null;
    }

    return {
      slug: parsed.slug,
      locale: parsed.locale ?? null,
      file,
      meta: content.meta,
    };
  }));

  for (const r of rawResults) {
    if (r) {
      items.push(r);
      if (items.length >= limit) break;
    }
  }`
);
fs.writeFileSync("packages/core/src/run-search.ts", content);
