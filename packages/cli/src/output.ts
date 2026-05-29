/**
 * Shared output utilities for CLI commands.
 * Handles JSON envelope vs pretty-print formatting in one place.
 */

import { inspect } from "node:util";
import type { ContentOpResult } from "@contenz/core/api";

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
			console.error(`\x1b[31mError:\x1b[0m ${result.error ?? "Unknown error"}`);
			if (result.diagnostics?.length) {
				for (const d of result.diagnostics) {
					console.error(`  ${d.field ? `${d.field}: ` : ""}${d.message}`);
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
			const formattedKey = `\x1b[1m${key}\x1b[0m`;
			if (
				typeof value === "object" &&
				value !== null &&
				!Array.isArray(value)
			) {
				console.log(`${pad}${formattedKey}:`);
				prettyPrint(value, indent + 1);
			} else if (Array.isArray(value)) {
				const formattedValues = value
					.map((v) =>
						typeof v === "string" ? v : inspect(v, { colors: true }),
					)
					.join(", ");
				console.log(`${pad}${formattedKey}: ${formattedValues}`);
			} else {
				const formattedValue =
					typeof value === "string" ? value : inspect(value, { colors: true });
				console.log(`${pad}${formattedKey}: ${formattedValue}`);
			}
		}
		return;
	}

	console.log(
		`${pad}${typeof data === "string" ? data : inspect(data, { colors: true })}`,
	);
}
