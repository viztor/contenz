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
			console.log(inspect(result.data, { colors: true, depth: null }));
		} else {
			const red = "\x1b[31m";
			const reset = "\x1b[0m";
			const yellow = "\x1b[33m";

			console.error(`${red}Error: ${result.error ?? "Unknown error"}${reset}`);
			if (result.diagnostics?.length) {
				for (const d of result.diagnostics) {
					console.error(`  ${d.field ? `${yellow}${d.field}${reset}: ` : ""}${d.message}`);
				}
			}
		}
	}
	process.exit(result.success ? 0 : 1);
}
