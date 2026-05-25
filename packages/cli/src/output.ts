/**
 * Shared output utilities for CLI commands.
 * Handles JSON envelope vs pretty-print formatting in one place.
 */

import type { ContentOpResult } from "@contenz/core/api";
import pc from "picocolors";

function formatValue(val: unknown): string {
	if (typeof val === "string") return pc.green(val);
	if (typeof val === "number" || typeof val === "boolean")
		return pc.yellow(String(val));
	return String(val);
}

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
			console.error(pc.red(`Error: ${result.error ?? "Unknown error"}`));
			if (result.diagnostics?.length) {
				for (const d of result.diagnostics) {
					const prefix = d.field ? pc.yellow(`${d.field}: `) : "";
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
			const formattedKey = pc.cyan(key);
			if (
				typeof value === "object" &&
				value !== null &&
				!Array.isArray(value)
			) {
				console.log(`${pad}${formattedKey}:`);
				prettyPrint(value, indent + 1);
			} else if (Array.isArray(value)) {
				const formattedArr = value.map(formatValue).join(", ");
				console.log(`${pad}${formattedKey}: ${formattedArr}`);
			} else {
				console.log(`${pad}${formattedKey}: ${formatValue(value)}`);
			}
		}
		return;
	}

	console.log(`${pad}${formatValue(data)}`);
}
