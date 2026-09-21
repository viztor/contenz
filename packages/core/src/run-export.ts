/**
 * Programmatic translation export: flatten content to translator-friendly
 * formats (per-locale JSON messages, XLIFF 1.2). Export only — importing
 * translations back is a separate design (merge policy, conflicts).
 *
 * Units are leaf strings of meta (dotted paths, arrays indexed) plus bodies:
 * `{ collection, slug, field, file, locale, value }`, keyed for messages as
 * `{collection}.{slug}.{field}`. Non-string leaves are skipped; empty strings
 * are skipped as noise. Files without a locale segment resolve through
 * defaultLocale, then "en" with a warning (explicit beats magic nowhere).
 */

import fs from "node:fs/promises";
import path from "node:path";

import { type Diagnostic, i18nDiagnostic } from "./diagnostics.js";
import { parseContentFile, parseFileName } from "./parser.js";
import { createWorkspace } from "./workspace.js";

export type ExportFormat = "messages" | "xliff";

export interface ExportOptions {
  cwd: string;
  /** Output format (default: "messages") */
  format?: ExportFormat;
  /** Only export this collection or single */
  collection?: string;
  /** Only export this locale (messages: one file; xliff: one target) */
  locale?: string;
  /** Output directory (default: `<cwd>/messages` or `<cwd>/xliff`) */
  outDir?: string;
}

export interface ExportResult {
  success: boolean;
  errors: number;
  /** Project-relative output file paths */
  files: string[];
  diagnostics: Diagnostic[];
}

export interface ExportUnit {
  collection: string;
  slug: string;
  field: string;
  file: string;
  locale: string;
  value: string;
}

/** Flatten unknown values to dotted string leaves (arrays indexed). */
export function flattenToStrings(
  value: unknown,
  prefix: string
): Array<{ path: string; value: string }> {
  const out: Array<{ path: string; value: string }> = [];
  if (typeof value === "string") {
    if (value.length > 0) out.push({ path: prefix, value });
    return out;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      out.push(...flattenToStrings(item, `${prefix}.${index}`));
    }
    return out;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      const childPrefix = prefix.length > 0 ? `${prefix}.${key}` : key;
      out.push(
        ...flattenToStrings(
          (value as Record<string, unknown>)[key],
          childPrefix
        )
      );
    }
  }
  return out;
}

/** Minimal XML escaping for XLIFF output (plus illegal-char stripping). */
export function escapeXml(value: string): string {
  // XML 1.0 allows only tab, LF, and CR below U+0020; strip the rest.
  // (Explicit loop instead of a control-char regex, which lint forbids.)
  let stripped = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 && ch !== "\n" && ch !== "\t" && ch !== "\r") continue;
    stripped += ch;
  }
  return stripped
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function unitId(
  unit: Pick<ExportUnit, "collection" | "slug" | "field">
): string {
  return `${unit.collection}.${unit.slug}.${unit.field}`;
}

/** Build export units for one parsed entry (meta leaves + body). */
export function collectEntryUnits(args: {
  collection: string;
  slug: string;
  file: string;
  locale: string;
  meta: Record<string, unknown>;
  body?: string;
}): ExportUnit[] {
  const { collection, slug, file, locale, meta, body } = args;
  const units: ExportUnit[] = [];
  for (const { path: fieldPath, value } of flattenToStrings(meta, "")) {
    units.push({ collection, slug, field: fieldPath, file, locale, value });
  }
  if (body !== undefined && body.trim().length > 0) {
    units.push({ collection, slug, field: "body", file, locale, value: body });
  }
  return units;
}

function renderMessages(units: ExportUnit[]): string {
  const messages: Record<string, string> = {};
  const sorted = [...units].sort((a, b) =>
    unitId(a) < unitId(b) ? -1 : unitId(a) > unitId(b) ? 1 : 0
  );
  for (const unit of sorted) {
    messages[unitId(unit)] = unit.value;
  }
  return `${JSON.stringify(messages, null, 2)}\n`;
}

function renderXliff(
  sourceLocale: string,
  targetLocale: string,
  units: ExportUnit[]
): string {
  const byCollection = new Map<string, ExportUnit[]>();
  for (const unit of units) {
    const list = byCollection.get(unit.collection) ?? [];
    list.push(unit);
    byCollection.set(unit.collection, list);
  }
  const sources = new Map<string, string>();
  const targets = new Map<string, string>();
  for (const unit of units) {
    if (unit.locale === sourceLocale) sources.set(unitId(unit), unit.value);
    if (unit.locale === targetLocale) targets.set(unitId(unit), unit.value);
  }

  let out = `<?xml version="1.0" encoding="UTF-8"?>\n<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n`;
  const names = [...byCollection.keys()].sort();
  for (const name of names) {
    out += `  <file original="${escapeXml(name)}" source-language="${escapeXml(sourceLocale)}" target-language="${escapeXml(targetLocale)}" datatype="plaintext">\n    <body>\n`;
    const seen = [...byCollection.get(name)!].sort((a, b) =>
      unitId(a) < unitId(b) ? -1 : unitId(a) > unitId(b) ? 1 : 0
    );
    const emitted = new Set<string>();
    for (const unit of seen) {
      const id = unitId(unit);
      if (emitted.has(id)) continue;
      emitted.add(id);
      const source = sources.get(id);
      if (source === undefined) continue;
      const target = targets.get(id);
      out += `      <trans-unit id="${escapeXml(id)}" xml:space="preserve">\n`;
      out += `        <source>${escapeXml(source)}</source>\n`;
      if (target !== undefined) {
        out += `        <target>${escapeXml(target)}</target>\n`;
      }
      out += `        <note>file: ${escapeXml(unit.file)}</note>\n`;
      out += `      </trans-unit>\n`;
    }
    out += `    </body>\n  </file>\n`;
  }
  out += `</xliff>\n`;
  return out;
}

export async function runExport(options: ExportOptions): Promise<ExportResult> {
  const diagnostics: Diagnostic[] = [];
  const cwd = path.resolve(process.cwd(), options.cwd ?? ".");
  const format = options.format ?? "messages";

  let workspace: Awaited<ReturnType<typeof createWorkspace>>;
  try {
    workspace = await createWorkspace({
      cwd,
      collection: options.collection,
    });
  } catch (error) {
    return {
      success: false,
      errors: 1,
      files: [],
      diagnostics: [
        i18nDiagnostic(
          "EXPORT_CONFIG_INVALID",
          "error",
          { source: "export" },
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
  }

  if (workspace.discoveryErrors.length > 0) {
    return {
      success: false,
      errors: workspace.discoveryErrors.length,
      files: [],
      diagnostics: workspace.discoveryErrors.map((message) =>
        i18nDiagnostic(
          "EXPORT_DISCOVERY_ERROR",
          "error",
          { source: "export" },
          message
        )
      ),
    };
  }

  const { resolvedConfig: baseConfig } = workspace;
  const defaultLocale = baseConfig.resolvedI18n.defaultLocale;
  const contexts = [...workspace.collections, ...workspace.singles];

  if (options.collection && contexts.length === 0) {
    return {
      success: false,
      errors: 1,
      files: [],
      diagnostics: [
        i18nDiagnostic(
          "EXPORT_COLLECTION_NOT_FOUND",
          "error",
          { source: "export" },
          `Collection or single "${options.collection}" not found.`
        ),
      ],
    };
  }

  const units: ExportUnit[] = [];
  let errors = 0;
  for (const ctx of contexts) {
    for (const file of ctx.contentFiles) {
      const parsed = parseFileName(
        file,
        ctx.config.i18n,
        ctx.config.slugPattern
      );
      if (!parsed) continue;
      let locale = parsed.locale ?? defaultLocale;
      if (!locale) {
        locale = "en";
        diagnostics.push(
          i18nDiagnostic(
            "EXPORT_LOCALE_ASSUMED",
            "warning",
            { source: "export", collection: ctx.name, file },
            `No locale for "${file}" and no defaultLocale configured; assuming "en".`
          )
        );
      }
      try {
        const content = await parseContentFile(
          path.join(ctx.collectionPath, file),
          ctx.config
        );
        units.push(
          ...collectEntryUnits({
            collection: ctx.name,
            slug: parsed.slug,
            file,
            locale,
            meta: content.meta,
            body: content.body,
          })
        );
      } catch (error) {
        errors += 1;
        diagnostics.push(
          i18nDiagnostic(
            "EXPORT_PARSE_FAILED",
            "error",
            { source: "export", collection: ctx.name, file },
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    }
  }

  const wanted = options.locale;
  const scoped = wanted ? units.filter((u) => u.locale === wanted) : units;

  const outDir = options.outDir
    ? path.resolve(cwd, options.outDir)
    : path.join(cwd, format);
  await fs.mkdir(outDir, { recursive: true });

  const files: string[] = [];
  if (format === "messages") {
    const byLocale = new Map<string, ExportUnit[]>();
    for (const unit of scoped) {
      const list = byLocale.get(unit.locale) ?? [];
      list.push(unit);
      byLocale.set(unit.locale, list);
    }
    for (const [locale, localeUnits] of [...byLocale.entries()].sort(
      ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)
    )) {
      const filePath = path.join(outDir, `${locale}.json`);
      await fs.writeFile(filePath, renderMessages(localeUnits), "utf-8");
      files.push(path.relative(cwd, filePath));
    }
  } else {
    const sourceLocale = defaultLocale ?? "en";
    const targets = [
      ...new Set(scoped.map((u) => u.locale).filter((l) => l !== sourceLocale)),
    ].sort();
    for (const target of targets) {
      const filePath = path.join(outDir, `${target}.xlf`);
      await fs.writeFile(
        filePath,
        renderXliff(sourceLocale, target, scoped),
        "utf-8"
      );
      files.push(path.relative(cwd, filePath));
    }
  }

  return { success: errors === 0, errors, files, diagnostics };
}
