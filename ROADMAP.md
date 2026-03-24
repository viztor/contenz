# contenz Roadmap

This roadmap is the milestone-level delivery plan. It should stay readable, dependency-ordered, and stable enough to guide work across multiple PRs.

## Current Status

- Baseline workspace split is done: `@contenz/core`, `@contenz/cli`, `@contenz/e2e`
- Current command surface is `init`, `lint`, `build`, `watch`, `status`
- Milestones 1–3 are complete: shared pipeline, diagnostics, incremental build, watch, status, i18n v2 (rich config, fallback, coverage, stale detection)
- The roadmap below continues with the documentation gate and Milestone 4

## Milestone 1: Shared Pipeline Core And Diagnostics

Status: complete

Goal:

Reduce duplicated build/lint orchestration and establish a stable diagnostics model before adding more command surface.

Deliverables:

- shared discovery logic for config, schema, and content traversal
- shared file and collection processing modules
- structured diagnostics with stable categories and codes
- formatter outputs for `pretty`, `json`, and `github`

Exit criteria:

- build and lint share internal pipeline modules
- no regression in current e2e fixtures
- machine-readable diagnostics are covered by tests

Outcome:

- shared source discovery and config normalization are in place
- `contenz init` exists for existing-project scaffolding
- build and lint emit structured diagnostics with `pretty`, `json`, and `github` output formats
- regression coverage includes programmatic and CLI formatter behavior

## Milestone 2: Incremental Build And Watch

Status: complete

Goal:

Make the normal content-edit loop fast enough for daily use.

Deliverables:

- manifest-backed incremental build engine
- `build --force`
- `build --dry-run`
- `lint --dry-run`
- `contenz watch`
- minimal `contenz status`

Exit criteria:

- unchanged collections can be skipped safely
- single-file edits only rebuild impacted outputs
- watch mode is stable on normal fixture projects

## Milestone 3: i18n v2 Core

Status: complete

Goal:

Move i18n from filename grouping into a broader runtime model.

Deliverables:

- richer i18n config shape
- locale fallback rules
- coverage thresholds and stale translation detection
- optional fallback metadata in generated output

Exit criteria:

- `i18n: true` remains backward-compatible
- fallback behavior and translation coverage policy are verified in e2e coverage

## Documentation Gate: Core API Stabilization

This is the documentation pass that should happen immediately after Milestone 3, before broader surface expansion.

Goal:

Freeze and document the pre-`v0.2` core API surface so the project has a clear, trustworthy contract for config, schema authoring, source discovery, CLI usage, and i18n behavior.

Deliverables:

- root docs updated for the current product and CLI model
- `@contenz/core` docs updated for schema helpers, config contracts, and programmatic APIs
- explicit reference material for:
  - source discovery semantics
  - collection identity and naming rules
  - collection-local config behavior
  - multi-type collection rules
  - current i18n semantics and compatibility rules
- clear marking of stable vs deprecated surface areas

Exit criteria:

- a user can set up, configure, lint, build, and understand contenz without reading source code
- config and discovery invariants are documented in one place, not spread across examples only
- the documented surface matches the behavior covered by tests

## Milestone 4: AI-Native Foundation

**Goal:** Transform contenz from a read-only build tool into a bidirectional, AI-native content management CLI.

This milestone is broken into three sequential phases to manage risk:

### Phase 4a: Introspection & The CLI Contract
Establish the foundation for AI agents to understand and mutate content.

**Deliverables:**
- **Schema Introspection Layer:** Extract fields, types, and descriptions from Zod schemas without validation.
- **Content I/O Module:** Symmetric read/update/write operations for content files.
- **New CLI Commands:** `create`, `update`, `view`, `search`, `list`.
- **Command Registry & Help:** Structured, self-describing command architecture with `contenz help --format json` and context-aware help.
- **Stable JSON Contract:** Guaranteed `success`, `data`, and `diagnostics` envelope for all `--format json` outputs.

**Exit Criteria:**
- An AI agent can discover commands, list collections, read an item, and create a new item entirely via the CLI using JSON formats.

### Phase 4b: Format Adapters & Schema Presets
Expand the content model beyond `.mdx` only, and solve the "blank page" problem.

**Deliverables:**
- **Format Adapter Pipeline:** Refactor the parser to support pluggable format adapters.
- **JSON Content Adapter:** Support `.json` files as first-class content items alongside `md`/`mdx`.
- **Dual MDX Metadata:** Support both `export const meta` and frontmatter in `.mdx` files.
- **Schema Presets:** Ship pre-built schemas (`blogPost`, `faq`, etc.) in `@contenz/core`.
- **Global Constraints:** Implement linting for cross-collection invariants (starting with `slugGroups` for `urlPrefix` collisions).

**Exit Criteria:**
- A single collection can mix `.mdx` and `.json` content safely.
- Users can bootstrap a collection using `presets.blogPost`.
- `contenz lint` catches slug collisions across collections sharing a URL prefix.

### Phase 4c: Workspace Integration & Skills
Close the loop on DX and AI agent onboarding.

**Deliverables:**
- **Smart Init:** `contenz init` detects Next.js, offers preset selection, and optionally scaffolds `mdx-components.tsx` and route handlers.
- **Skill Generator:** `contenz skill` command to generate `.agents/skills/contenz/SKILL.md` and workflows tailored to the project's actual schema.

**Exit Criteria:**
- A developer can run `contenz init`, pick a few presets, and have a working Next.js content route in 30 seconds.
- Running `contenz skill` generates a markdown file that successfully teaches Cursor/Copilot/Gemini how to edit the project's specific collections.

---

## Milestone 5: Consumption & Extensibility (v1.0 Candidate)

**Goal:** Make generated content robust to query, and establish stable extension hooks before reaching v1.0.

**Deliverables:**
- **Query API:** Type-safe helpers for filtering, sorting, pagination, and relation joins against generated output.
- **Extension Hooks:** Lifecycle hooks, transform pipeline, validation plugins.
- **Computed Fields:** Ability to define fields derived from other content at build time.

**Exit Criteria:**
- Next.js server components can cleanly query content with relations fully typed.
- Hooks and plugins are covered by integration tests.

---

## Future Product Track: Authoring Studio

This is not the current milestone focus, but it is part of the intended product scope.

**Goal:** Provide a deployable, git-backed authoring interface so content teams can work directly inside contenz visually without dealing with raw files or CLI commands.

**Expected capabilities:**
- schema-driven editing UI
- locale-aware authoring and review
- relation pickers and guided field editing
- preview
- integrated AI assistance for drafting and translation
- branch + PR oriented collaboration

**Prerequisite:**
The core data model, schema introspection, and Content I/O symmetric layer (M4a) must be rock solid. The studio relies on the exact same I/O and introspection primitives as the CLI.

---

## Deferred Until After Milestone 5

- remote content adapters (headless CMS sync)
- asset pipeline breadth (image optimization orchestration)
- graph visualization
- worker-thread parsing (unless profiling proves the need)

---

## Release Target

The intended `v1.0` release should include the completion of Milestones 1 through 5, delivering a complete, bidirectional, AI-native content lifecycle from scaffolding to agent-driven updates to type-safe frontend querying.
