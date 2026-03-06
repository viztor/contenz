# CLI reference

The `contenz` CLI is provided by `@contenz/cli`. All commands accept `--cwd` to run against a different project root.

## Commands overview

| Command | Description |
|---------|-------------|
| `contenz init` | Scaffold Contenz into the current (or `--cwd`) project |
| `contenz lint` | Validate all content and optionally write a coverage report |
| `contenz build` | Generate typed content files (incremental when possible) |
| `contenz watch` | Watch content and config, run build on change |
| `contenz status` | Report whether build is up to date or which collections would be rebuilt |
| `contenz studio` | Start the Contenz Authoring Studio (Next.js app) |

## Global behavior

- **Project root**: Commands look for `contenz.config.ts` (or `.mjs` / `.js`) in the current directory unless `--cwd <path>` is set.
- **Exit codes**: `status` exits `1` when a build is needed; other commands use non-zero on validation or build failure.

---

## init

Scaffold Contenz into an existing project: create config, a starter collection schema, and sample content.

```bash
contenz init
contenz init --cwd ../my-app
contenz init --i18n
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root where `contenz.config.ts` and content will live. |
| `--i18n` | `false` | Scaffold an i18n-ready config and sample locale-based content. |

After running `init`, install `@contenz/core` and `zod` in the target project if not already present, then run `contenz lint` or `contenz build`.

---

## lint

Validate all content against collection schemas, run relation checks, and optionally write a coverage report.

```bash
contenz lint
contenz lint --coverage
contenz lint --collection faq
contenz lint --format json
contenz lint --cwd ./content-repo
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root. |
| `--collection` | *(all)* | Limit validation to one collection name. |
| `--coverage` | `false` | Write the coverage report to the path in config (`coveragePath`). |
| `--format` | `pretty` | Output format: `pretty`, `json`, or `github`. |
| `--dry-run` | `false` | Run validation without writing the coverage file. |

- **pretty**: Human-readable terminal output.
- **json**: Machine-readable diagnostics for automation.
- **github**: Emit GitHub Actions workflow commands (e.g. annotations).

---

## build

Generate typed content files. Uses a manifest (`.contenz/build-manifest.json`) to skip unchanged collections.

```bash
contenz build
contenz build --force
contenz build --dry-run
contenz build --format github
contenz build --cwd ./content-repo
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root. |
| `--force` | `false` | Ignore manifest and rebuild all collections. |
| `--dry-run` | `false` | Report what would be built without writing files. |
| `--format` | `pretty` | Output format: `pretty`, `json`, or `github`. |

Output is written to the `outputDir` from config (default `generated/content/`). Each collection gets a TypeScript file (e.g. `faq.ts`). See [Content model – Generated output](./CONTENT-MODEL.md#generated-output-shape).

---

## watch

Watch content and config files; run build on change. Useful for local editing with live regeneration.

```bash
contenz watch
contenz watch --cwd ./content-repo
contenz watch --format json
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root. |
| `--format` | `pretty` | Diagnostic formatter for the inner build. |

Watched paths are derived from project config `sources`. Changes to `contenz.config.*`, `**/schema.ts`, `**/config.ts`, and `*.md`/`*.mdx` trigger a debounced build. Press Ctrl+C to stop.

---

## status

Report whether the last build is still up to date or which collections would be rebuilt.

```bash
contenz status
contenz status --cwd ./content-repo
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root. |

Exit code is `0` when up to date, `1` when a build is needed. Useful in CI or scripts to decide whether to run `contenz build`.

---

## studio

Start the Contenz Authoring Studio: a Next.js app that lets you browse collections, open documents, edit metadata and body, and search content. The app reads and writes content in the repo via `CONTENZ_PROJECT_ROOT`.

```bash
contenz studio
contenz studio --cwd ./my-content
contenz studio --port 3002
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root (content sources and `contenz.config`). Becomes `CONTENZ_PROJECT_ROOT`. |
| `--port` | `3001` | Port for the studio dev server. |

The CLI resolves `@contenz/studio`, sets `CONTENZ_PROJECT_ROOT` to the resolved `--cwd`, and runs the studio’s `npm run dev` with the given port. Open the printed URL (e.g. http://localhost:3001). See [Studio](./STUDIO.md) for details.
