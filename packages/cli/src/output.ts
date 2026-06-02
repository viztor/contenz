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
			console.error(`Error: ${result.error ?? "Unknown error"}`);
			if (result.diagnostics?.length) {
				for (const d of result.diagnostics) {
					console.error(`  ${d.field ? `${d.field}: ` : ""}${d.message}`);
				}
			}
		}
	}
	process.exit(result.success ? 0 : 1);
}

function prettyPrint(data: unknown): void {
	if (data === null || data === undefined) return;
	console.log(inspect(data, { colors: true, depth: null }));
}
