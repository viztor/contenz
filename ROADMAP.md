# contenz Roadmap

This roadmap is the milestone-level delivery plan. It should stay readable, dependency-ordered, and stable enough to guide work across multiple PRs.

## Current Status

- Baseline workspace split is done: `@contenz/core`, `@contenz/cli`, `@contenz/adapter-mdx`, `@contenz/e2e`
- Current command surface is `init`, `lint`, `build`, `watch`, `status`, `view`, `list`, `create`, `update`, `search`, `schema`
- Milestones 1–3 are complete
- Documentation Gate is complete
- Milestone 4: Complete
- Packages published to npm as `@contenz/core` (v0.2.0), `@contenz/adapter-mdx`, `@contenz/cli` (adapter/cli 0.2.0 ships multiline JSON-ish YAML frontmatter)

## Milestone 1: Shared Pipeline Core And Diagnostics

Status: **complete**

Goal: Reduce duplicated build/lint orchestration and establish a stable diagnostics model.

Outcome:

- Shared source discovery and config normalization
- `contenz init` for existing-project scaffolding
- Structured diagnostics with `pretty`, `json`, and `github` output formats

## Milestone 2: Incremental Build And Watch

Status: **complete**

Goal: Make the normal content-edit loop fast enough for daily use.

Outcome:

- Manifest-backed incremental build engine
- `build --force`, `build --dry-run`, `lint --dry-run`
- `contenz watch` and `contenz status`

## Milestone 3: i18n v2 Core

Status: **complete**

Goal: Move i18n from filename grouping into a broader runtime model.

Outcome:

- Richer i18n config shape with locale fallback rules
- Coverage thresholds and stale translation detection
- Backward-compatible `i18n: true` flag

## Documentation Gate: Core API Stabilization

Status: **complete**

Goal: Freeze and document the pre-`v0.2` core API surface.

Outcome:

- `docs/CONFIGURATION.md` — centralized and cascaded config patterns
- `docs/CONTENT-MODEL.md` — metadata formats (frontmatter, export const meta, JSON)
- `docs/CLI.md` — all 11 commands documented
- `docs/API.md` — programmatic API reference
- `docs/ARCHITECTURE.md` — pipeline and package relationships
- `docs/CODEBASE.md` — maintainer-facing module map and cleanup items

## Milestone 4: AI-Native Foundation

**Goal:** Transform contenz from a read-only build tool into a bidirectional, AI-native content management CLI.

### Phase 4a: Introspection & The CLI Contract

Status: **complete**

Outcome:

- Schema introspection layer (`introspectSchema`, `introspectField`)
- Content I/O module (`readContent`, `writeContent`, `updateContent`)
- CLI commands: `create`, `update`, `view`, `search`, `list`, `schema`
- Stable JSON contract for all `--format json` outputs

### Phase 4b: Format Adapters & Schema Presets

Status: **complete**

Completed:

- ✅ Format adapter pipeline (`FormatAdapter` interface, `registerAdapters()`)
- ✅ JSON content adapter (built-in, first-class `.json` support)
- ✅ `@contenz/adapter-mdx` — MD/MDX format adapter with both frontmatter and `export const meta`
- ✅ Centralized inline collection config (`collections` field in `contenz.config.ts`)
- ✅ Schema presets (`presets.blogPost`, `presets.faq`, etc.)
- ✅ Global constraints / slug group collision detection

### Phase 4c: Workspace Integration & Skills

Status: **complete**

Deliverables:

- **Smart Init:** `contenz init` detects Next.js, offers preset selection, scaffolds route handlers
- **Skill Generator:** `contenz skill` generates AI agent skill files tailored to the project's actual schema

---

## Milestone 5: Consumption & Extensibility (v1.0 Candidate)

Status: **complete**

**Goal:** Make generated content robust to query, and establish stable extension hooks.

**Deliverables:**

- **App consumption:** import generated modules from build output; locale/query helpers live in the app
- **Extension Hooks:** Lifecycle hooks (`beforeBuild`, `transformItem`, `afterBuild`)
- **Computed Fields:** Fields dynamically derived from other content at build time

---

## Future Product Track: Preview & Review UI

This is not the current milestone focus, but it is part of the intended product scope.

**Goal:** Provide a lightweight, deployable dashboard that renders the repo-backed content and its schema validation status in a beautiful way, providing a visual "Diff/PR" viewer for non-technical stakeholders to review what AI agents have authored.

**Prerequisite:** The core data model, schema introspection, and Content I/O layer (M4a) are rock solid, allowing the Preview UI to render content effortlessly without needing to handle the complex state of a full GUI editor.

---

## Deferred Until After Milestone 5

- remote content adapters (headless CMS sync)
- asset pipeline breadth (image optimization orchestration)
- graph visualization
- worker-thread parsing (unless profiling proves the need)

---

## Release Target

The intended `v1.0` release should include the completion of Milestones 1 through 5, delivering a complete, bidirectional, AI-native content lifecycle from scaffolding to agent-driven updates to type-safe frontend querying.
