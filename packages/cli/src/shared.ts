/**
 * Shared flag specs and parsers for contenz CLI commands.
 */

import type { TypedFlagParameter } from "@stricli/core";
import { numberParser } from "@stricli/core";

import type { ContenzContext } from "./context.js";

export type DiagnosticFormat = "pretty" | "json" | "github";
export type OutputFormat = "json" | "pretty";
export type SkillFormat = "md" | "json";

type Flag<T> = TypedFlagParameter<T, ContenzContext>;

/** Project root (where contenz.config.ts lives) */
export const cwdFlag = {
  kind: "parsed",
  brief: "Project root (where contenz.config.ts lives)",
  parse: String,
  default: ".",
  placeholder: "path",
} as const satisfies Flag<string>;

/** Pipeline diagnostic format (lint/build/watch) */
export const diagnosticFormatFlag = {
  kind: "enum",
  values: ["pretty", "json", "github"] as const,
  brief: "Diagnostic formatter: pretty, json, or github",
  default: "pretty",
} as const satisfies Flag<DiagnosticFormat>;

/** AI-native command output format (view/list/create/…) */
export const outputFormatFlag = {
  kind: "enum",
  values: ["json", "pretty"] as const,
  brief: "Output format: json or pretty",
  default: "json",
} as const satisfies Flag<OutputFormat>;

export const localeFlag = {
  kind: "parsed",
  brief: "Locale for the content item",
  parse: String,
  optional: true,
  placeholder: "locale",
} as const satisfies Flag<string | undefined>;

export const contentTypeFlag = {
  kind: "parsed",
  brief: "Content type (for multi-type collections)",
  parse: String,
  optional: true,
  placeholder: "type",
} as const satisfies Flag<string | undefined>;

/** Repeatable --set key=value */
export const setFlag = {
  kind: "parsed",
  brief: "Set field values (key=value), repeatable",
  parse: String,
  variadic: true,
  optional: true,
  placeholder: "key=value",
} as const satisfies Flag<readonly string[] | undefined>;

/** Repeatable --unset field */
export const unsetFlag = {
  kind: "parsed",
  brief: "Remove optional fields, repeatable",
  parse: String,
  variadic: true,
  optional: true,
  placeholder: "field",
} as const satisfies Flag<readonly string[] | undefined>;

/** Repeatable --field key=value for search */
export const fieldFilterFlag = {
  kind: "parsed",
  brief: "Filter by field value (key=value), repeatable",
  parse: String,
  variadic: true,
  optional: true,
  placeholder: "key=value",
} as const satisfies Flag<readonly string[] | undefined>;

export const limitFlag = {
  kind: "parsed",
  brief: "Maximum number of results",
  parse: numberParser,
  optional: true,
  placeholder: "n",
} as const satisfies Flag<number | undefined>;

export const dryRunFlag = {
  kind: "boolean",
  brief: "Report only; do not write files",
  default: false,
} as const satisfies Flag<boolean>;

export const forceFlag = {
  kind: "boolean",
  brief: "Force overwrite / rebuild, ignore cache",
  default: false,
} as const satisfies Flag<boolean>;

/** Parse --set key=value pairs into a meta record (JSON values when valid). */
export function parseSetPairs(
  pairs: readonly string[] | undefined
): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (!pairs) return meta;
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) {
      throw new Error(`Invalid --set format: "${pair}". Expected key=value`);
    }
    const key = pair.slice(0, eqIdx);
    const rawValue = pair.slice(eqIdx + 1);
    try {
      meta[key] = JSON.parse(rawValue);
    } catch {
      meta[key] = rawValue;
    }
  }
  return meta;
}

/** Parse --field key=value pairs into a string record. */
export function parseFieldPairs(
  pairs: readonly string[] | undefined
): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!pairs) return fields;
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) {
      throw new Error(`Invalid --field format: "${pair}". Expected key=value`);
    }
    fields[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
  }
  return fields;
}
