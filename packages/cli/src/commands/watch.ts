/**
 * Watch content and config, run build on change.
 */

import fs from "node:fs";
import path from "node:path";
import type { ContenzConfig } from "@contenz/core/api";
import {
	loadProjectConfig,
	resolveSourcePatterns,
	runBuild,
} from "@contenz/core/api";
import { defineCommand } from "citty";

function resolveWatchRoots(cwd: string, sources: string[]): string[] {
	const roots: string[] = [cwd];
	for (const source of sources) {
		const base = source.endsWith("/*") ? source.slice(0, -2) : source;
		const resolved = path.resolve(cwd, base);
		if (!roots.includes(resolved)) roots.push(resolved);
	}
	return roots;
}

function isRelevantFile(relativePath: string): boolean {
	const p = relativePath.replace(/\\/g, "/");
	if (/^contenz\.config\.(ts|mjs|js)$/.test(p)) return true;
	if (/\/schema\.ts$/.test(p)) return true;
	if (/\/config\.ts$/.test(p)) return true;
	if (/\.(md|mdx)$/.test(p)) return true;
	return false;
}

export const watchCommand = defineCommand({
	meta: {
		name: "watch",
		description: "Watch content and config, run build on change",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root (where contenz.config.ts lives)",
			default: ".",
		},
		format: {
			type: "string",
			description: "Diagnostic formatter: pretty, json, or github",
			default: "pretty",
		},
	},
	async run({ args }) {
		const cwd = path.resolve(process.cwd(), args.cwd);
		let projectConfig: ContenzConfig = {};
		try {
			projectConfig = await loadProjectConfig(cwd);
		} catch {
			// use defaults
		}
		const sources = resolveSourcePatterns(projectConfig);
		const watchRoots = resolveWatchRoots(cwd, sources);

		let debounceTimer: ReturnType<typeof setTimeout> | null = null;
		const DEBOUNCE_MS = 200;

		function run() {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(async () => {
				debounceTimer = null;
				const result = await runBuild({
					cwd: args.cwd,
					format: (args.format as "pretty" | "json" | "github") ?? "pretty",
				});
				console.log(result.report);
				if (!result.success) {
					console.error("Build had errors. Watching for further changes.");
				}
			}, DEBOUNCE_MS);
		}

		console.log("Watching for changes... (Ctrl+C to stop)");
		run();

		const watchers: fs.FSWatcher[] = [];
		for (const root of watchRoots) {
			try {
				const w = fs.watch(root, { recursive: true }, (eventType, filename) => {
					if (!filename) return;
					const relative = path.relative(root, path.join(root, filename));
					if (isRelevantFile(relative)) run();
				});
				watchers.push(w);
			} catch (err) {
				console.warn(`Could not watch ${root}:`, err);
			}
		}

		process.on("SIGINT", () => {
			for (const w of watchers) w.close();
			process.exit(0);
		});
	},
});
