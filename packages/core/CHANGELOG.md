# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Programmatic API** (`contenz/api`): `runLint`, `runBuild`, and `loadProjectConfig` for use in scripts and build pipelines.
- **Config fallback**: Project config can be `content.config.ts`, `content.config.mjs`, or `content.config.js` (first found wins).
- **Parallelism**: Lint and build process collections in parallel (using `p-map` with concurrency 4).
- **Istanbul coverage**: `npm run test:coverage` for Vitest with Istanbul provider.
- **Biome**: Replaced ESLint + Prettier with Biome for lint and format (`npm run lint`, `npm run lint:fix`, `npm run check`).
- **tsup**: Replaced `tsc` build with tsup for faster ESM + dts output.
- **Knip**: `npm run knip` for dead code and unused dependency detection.

### Changed

- CLI commands now delegate to shared `runLint` / `runBuild`; behavior is unchanged.

[Unreleased]: https://github.com/your-org/contenz/compare/v0.1.0...HEAD
