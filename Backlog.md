# contenz Backlog

This backlog is the short-horizon execution queue. It should stay actionable and readable. Large speculative scope belongs in `PROJECT_SCOPE.md`; milestone sequencing belongs in `ROADMAP.md`.

## Current Focus

Milestones 1–3 are complete. Current focus is Milestone 4: AI-Native Foundation.

Near-term boundary: design and build the schema introspection and symmetric I/O primitives required for the bidirectional CLI commands.

### Done Recently

- Milestone 2: manifest-backed incremental build, build --force, build --dry-run, lint --dry-run, contenz watch, contenz status.
- Milestone 3: richer i18n config (I18nConfigShape), locale fallback rules, coverage thresholds and stale translation detection, optional _fallback metadata in generated output; i18n: true remains backward-compatible.
- E2E coverage for dry-run, force, status, and i18n backward compat.

### Active

- Architecture alignment: finalize the data model for format adapters, schema introspection, and self-describing commands.

## Next Up (Milestone 4a: Introspection & The CLI Contract)

- Build `src/introspect.ts`: extract structural metadata (type, descriptions, defaults) from Zod schemas without validation
- Build `src/content-io.ts`: symmetric read/update/write operations for content files
- Implement command registry pattern for self-describing commands
- Build `contenz view`, `contenz create`, `contenz update` emitting strict `--format json` output

## After That (Milestone 4b & 4c)

- Format Adapters: support `.json` files and dual `.mdx` metadata extraction
- Schema Presets: ship `blogPost`, `faq`, etc. schemas in `@contenz/core`
- `contenz skill`: workspace integration generator for AI agents
- `contenz init`: smart scaffolding for existing Next.js projects

## Later (Milestone 5)

- query API baseline
- first practical Next.js integration
- extensibility MVP for hooks, transforms, and plugins

## Deferred Product Wedge

After the AI-native and consumption milestones, the next broader product wedges are:

- A git-backed authoring studio for human collaboration
- `npm create contenz@latest` via `create-contenz` for standalone docs/helpdesk site starters, separate from the persistent CLI

(Note: `contenz init` in the persistent CLI is no longer deferred; it is a core part of Milestone 4c for workspace integration.)

These stay out of the active backlog until the AI CLI logic (introspection, symmetric I/O) is rock solid. Site scaffolding is a future starter flow, not a `publish` feature.

## Working Rules

- every backlog item should map cleanly to one or a few PRs
- new CLI behavior should be covered by `packages/e2e`
- shared pipeline logic belongs in `packages/core`
- keep the backlog near-term; move broad future scope back to `ROADMAP.md`
