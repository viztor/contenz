/**
 * Shared output utilities for CLI commands.
 * Handles JSON envelope vs pretty-print formatting in one place.
 */

import { inspect } from "node:util";
import type { ContentOpResult } from "@contenz/core/api";

const colors = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
};

/**
 * Print the result and exit with appropriate code.
 */
export function printAndExit(result: ContentOpResult, format: string): never {
	if (format === "json") {
		console.log(JSON.stringify(result, null, 2));
	} else {
		if (result.success && result.data) {
			prettyPrint(result.data);
		} else {
			console.error(
				`${colors.red}${colors.bold}Error:${colors.reset} ${result.error ?? "Unknown error"}`,
			);
			if (result.diagnostics?.length) {
				for (const d of result.diagnostics) {
					const prefix = d.field
						? `${colors.yellow}${d.field}${colors.reset}: `
						: "";
					console.error(`  ${prefix}${d.message}`);
				}
			}
		}
	}
	process.exit(result.success ? 0 : 1);
}

function prettyPrint(data: unknown, indent = 0): void {
	if (data === null || data === undefined) return;
	const pad = "  ".repeat(indent);

	if (Array.isArray(data)) {
		for (const item of data) {
			prettyPrint(item, indent);
			if (typeof item === "object") console.log();
		}
		return;
	}

	if (typeof data === "object") {
		for (const [key, value] of Object.entries(
			data as Record<string, unknown>,
		)) {
			const coloredKey = `${colors.bold}${key}${colors.reset}`;
			if (
				typeof value === "object" &&
				value !== null &&
				!Array.isArray(value)
			) {
				console.log(`${pad}${coloredKey}:`);
				prettyPrint(value, indent + 1);
			} else if (Array.isArray(value)) {
				const formatted = value
					.map((v) =>
						typeof v === "string" ? v : inspect(v, { colors: true }),
					)
					.join(", ");
				console.log(`${pad}${coloredKey}: ${formatted}`);
			} else {
				console.log(
					`${pad}${coloredKey}: ${typeof value === "string" ? value : inspect(value, { colors: true })}`,
				);
			}
		}
		return;
	}

	console.log(
		`${pad}${typeof data === "string" ? data : inspect(data, { colors: true })}`,
	);
}
