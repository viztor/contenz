/**
 * Shared output utilities for CLI commands.
 * Handles JSON envelope vs pretty-print formatting; sets process.exitCode.
 *
 * Takes ContenzContext as an explicit argument (not `this`) so bundlers and
 * oxc/no-this-in-exported-function stay happy.
 */

import type { ContentOpResult } from "@contenz/core/api";

import type { ContenzContext } from "./context.js";
import type { OutputFormat } from "./shared.js";

/**
 * Print the result and set exit code (does not process.exit — Stricli owns that).
 */
export function printResult(
  ctx: ContenzContext,
  result: ContentOpResult,
  format: OutputFormat | string
): void {
  if (format === "json") {
    ctx.process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.success && result.data !== undefined) {
    prettyPrint(ctx, result.data);
  } else {
    ctx.process.stderr.write(`Error: ${result.error ?? "Unknown error"}\n`);
    if (result.diagnostics?.length) {
      for (const d of result.diagnostics) {
        ctx.process.stderr.write(
          `  ${d.field ? `${d.field}: ` : ""}${d.message}\n`
        );
      }
    }
  }
  if (!result.success) {
    ctx.process.exitCode = 1;
  }
}

function prettyPrint(ctx: ContenzContext, data: unknown, indent = 0): void {
  if (data === null || data === undefined) return;
  const pad = "  ".repeat(indent);

  if (Array.isArray(data)) {
    for (const item of data) {
      prettyPrint(ctx, item, indent);
      if (typeof item === "object" && item !== null) {
        ctx.process.stdout.write("\n");
      }
    }
    return;
  }

  if (typeof data === "object") {
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>
    )) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        ctx.process.stdout.write(`${pad}${key}:\n`);
        prettyPrint(ctx, value, indent + 1);
      } else if (Array.isArray(value)) {
        ctx.process.stdout.write(`${pad}${key}: ${value.join(", ")}\n`);
      } else {
        ctx.process.stdout.write(`${pad}${key}: ${value}\n`);
      }
    }
    return;
  }

  ctx.process.stdout.write(`${pad}${data}\n`);
}

/** Write a line to stdout */
export function log(ctx: ContenzContext, message: string): void {
  ctx.process.stdout.write(`${message}\n`);
}

/** Write a line to stderr */
export function logError(ctx: ContenzContext, message: string): void {
  ctx.process.stderr.write(`${message}\n`);
}

/** Fail the command with a message and exit code 1 */
export function fail(ctx: ContenzContext, message: string): void {
  ctx.process.stderr.write(`${message}\n`);
  ctx.process.exitCode = 1;
}
