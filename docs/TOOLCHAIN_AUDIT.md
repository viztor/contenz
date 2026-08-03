# Toolchain & Structural Audit

> **Status legend**: 🔴 broken / blocking · 🟠 inconsistent / risky · 🟢 healthy **Scope**: maintainability and usability of the contenz monorepo toolchain across all 6 packages. Each finding cites evidence and has acceptance criteria so it can be verified, not just claimed done. Re-run the verification commands after any remediation and update the status column.

Baseline (verified on a clean checkout): `npm run build`, `npm run test` (377 passing), `npm run lint`, `npm run typecheck`, and `npm run knip` all exit 0. Everything below is structural — green pipelines that hide gaps, drift, or broken runtime behavior.

---

## 1. Findings register

### A. Runtime contract — Preview UI ↔ server

| # | Finding | Status | Evidence |
| --- | --- | --- | --- |
| A* | Preview UI package, `contenz preview` CLI, and related e2e were **removed** from the monorepo | 🟢 removed | `packages/preview` deleted; no `preview` subcommand in `packages/cli/src/cli.ts` |

Historical notes (A1–A5) about the SPA/API contract are obsolete after removal.

### B. Quality gate coverage (Turbo silently skips missing scripts)

Script presence per package — Turbo reports "N successful" counting only packages that _declare_ the task:

| Package | build | test | typecheck | lint | knip | Status |
| --- | --- | --- | --- | --- | --- | --- |
| core | ✓ | ✓ | ✓ | ✓ Biome | ✓ | 🟢 |
| client | ✓ | ✓ | ✓ | ✓ Biome | ✓ | 🟢 |
| adapter-mdx | ✓ | ✓ | ✓ | — | — | 🟠 |
| cli | ✓ | — | ✓ | — | — | 🔴 published, untested, unlinted |
| preview | — | — | — | — | — | 🟢 removed |
| e2e | — | ✓ | — | — | — | 🟠 no typecheck on test code |

**Acceptance criteria**: every published package declares `test`, `typecheck`, `lint`; `npm run lint` checks ≥ 5 packages (currently 3); a CLI smoke test exists (can be the e2e suite owning it, documented as such).

### C. Gate alignment — local hooks vs CI vs docs

| Gate      | pre-commit | CI  | CONTRIBUTING.md says |
| --------- | ---------- | --- | -------------------- |
| typecheck | ✓          | ✗   | pre-push             |
| lint      | ✓          | ✓   | pre-push             |
| knip      | ✓          | ✓   | —                    |
| test      | ✗          | ✓   | pre-push             |

Status: 🟠. CI can pass commits that local hooks would reject (type errors) and vice versa. Evidence: `.husky/pre-commit`, `.github/workflows/ci.yml`.

**Acceptance criteria**: CI runs `typecheck`; CONTRIBUTING.md table matches both files exactly; core coverage floor (`packages/core/vitest.config.ts`, 30/30/30/20) is enforced in CI via `test:coverage`, not just available locally.

### D. Documentation drift

| Doc | Drift | Status |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` | Lists 4 packages; `client` and `preview` absent | 🔴 |
| `docs/CODEBASE.md` | "All known technical debt addressed"; omits `preview`, `client`, `skill`/`preview` commands; test counts stale (says 72 core / 114 e2e; actual 170 / 180) | 🔴 |
| `docs/CLI.md` | Missing `preview`, `skill` (12 of 13 commands) | 🟢 fixed |
| `README.md` | Missing `preview`, `skill`, both newer packages | 🟢 fixed |
| `packages/preview/README.md` | (package removed) | 🟢 removed |
| `CONTRIBUTING.md` | References removed "Studio"; mentions `BACKLOG.md` which does not exist | 🟠 |
| `Plan.md` | Stale planning artifact; todos marked `pending` for shipped features (watch, incremental, status); conflicts with `ROADMAP.md` | 🟠 |
| `skills/contenz/SKILL.md` | Points to `docs/CLI.md` as source of truth → inherits its gaps | 🟠 fixed transitively by CLI.md update |

**Acceptance criteria**: a single grep test — every command in `packages/cli/src/cli.ts` `subCommands` appears in `docs/CLI.md`; every directory in `packages/*` appears in `docs/ARCHITECTURE.md`. This check is cheap enough to script in CI later.

### E. E2E structural duplication

| Finding | Status | Evidence |
| --- | --- | --- |
| `ensureSymlink` helper copy-pasted into 3 test files | 🟠 | `e2e.test.ts`, `e2e-advanced.test.ts`, `e2e-stress.test.ts` |
| Fixture lists differ per file (`centralized` in one, `large-project` in another) | 🟠 | `FIXTURES_WITH_SCHEMA` definitions |
| Fixture wiring mutates `node_modules` via symlinks at test time — works, but invisible to newcomers and undocumented in `fixtures/README.md` | 🟠 | `beforeAll` blocks |
| `.contenz/build-manifest.json` files for fixtures are tracked and perpetually dirty in git (absolute `cwd` baked in) | 🟠 | git status; `fixtures/*/.contenz/build-manifest.json` contains `"cwd": "/Users/viz/..."` |

**Acceptance criteria**: one `packages/e2e/setup.ts` exporting the symlink helper and a single fixture registry; fixture `.contenz/` output gitignored (manifest embeds machine-specific absolute paths — it should never be committed).

### F. Tooling fragmentation

| Finding | Status |
| --- | --- |
| Two lint stacks: Biome (core, client) and ESLint (preview); cli/adapter-mdx have neither | 🟠 |
| `packages/client` runs Biome with no `biome.json` (implicit defaults; core has explicit config) | 🟠 |
| Compile targets / engines: Node.js LTS (`node24` tsup, `engines.node: >=24`, CI `lts/*`) | 🟢 |
| Internal deps pinned as `^0.1.6` instead of `workspace:*` — resolves via lockfile today; breaks the moment a version bump is uneven | 🟠 |
| `@contenz/preview` package | 🟢 removed |

**Acceptance criteria**: tsup targets and `engines` match current Node LTS; CI uses `lts/*`; publish flow tested via `npm pack` tarball install at least once per release.

### G. Release pipeline

| Finding | Status |
| --- | --- |
| Publish order in `scripts/publish.mjs` is correct (core → client → adapter-mdx → cli) | 🟢 |
| Provenance enabled in `publish.yml` | 🟢 |
| (preview tarball smoke obsolete — package removed) | 🟢 removed |
| Version bumps are manual across 6 `package.json` files + cross-dep ranges | 🟠 |

**Acceptance criteria**: a `publish:verify` step that packs tarballs into a temp dir, installs, and runs `contenz --version`, `contenz init`, `contenz build` smoke.

---

## 2. Remediation phases

### Phase 1 — fix what ships broken _(done)_

- [x] A1: `/api/list` passes `collection` (and `/api/view` passes `locale`)
- [x] A2/A3: SPA unwraps envelope; types match core exports
- [x] A5: `e2e-preview.test.ts` smoke suite (4 tests; registered in `packages/e2e/vitest.config.ts`)
- [x] D: `skill` in `docs/CLI.md` and `README.md` (`preview` removed from product)

Verified: build, typecheck, lint, and full e2e suite (184 tests) all pass post-fix.

### Phase 2 — unify quality gates

- [x] B: `test`/`typecheck`/`lint` on published packages + e2e; CLI has Stricli unit tests
- [x] C: CI runs typecheck + format + coverage (pnpm, Node `lts/*`)
- [x] F: tsup targets + engines = Node LTS (`node24` / `>=24`); CI `node-version: lts/*`

### Phase 3 — structural maintainability

- [x] E: `packages/e2e/setup.ts`; fixture registry; gitignore fixture `.contenz/`
- [x] D: `docs/ARCHITECTURE.md` + `docs/CODEBASE.md` updated (5 packages, Stricli, client)
- [x] F: internal deps use `workspace:*`
- [x] D: CONTRIBUTING.md pnpm/oxc; CLI on Stricli

### Phase 4 — platform usability

- [x] A: preview package removed (no SPA type sync needed)
- [x] CLI: full Stricli migration (typed flags, help/version, bash completion)
- [x] `@contenz/client` examples in `docs/USAGE.md`
- [ ] G: `publish:verify` tarball smoke test
- [ ] Consider `contenz doctor` (config valid, build fresh)

---

## 3. Verification commands

```bash
npm run build && npm run typecheck && npm run lint && npm run knip && npm run test

# Gate coverage check: which packages actually run each task
npx turbo run lint --dry-run=json | jq '.tasks[].taskId'

# Doc parity spot-checks
grep -o '"[a-z]*":' packages/cli/src/cli.ts   # command list…
grep '^| `contenz' docs/CLI.md                # …must appear here

# Preview contract (after Phase 1)
# (e2e-preview removed with the preview package)
```
