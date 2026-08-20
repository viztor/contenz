import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

/**
 * Universal Ultracite oxlint quality gates.
 * - ERROR = CI-blocking code quality
 * - WARN = tracked debt (not silent)
 * - OFF = not a quality gate (style/metrics)
 * Do not demote ERROR gates per project without a documented exception.
 */
export default defineConfig({
  extends: [core],
  options: {
    typeAware: true,
  },
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "**/.turbo/**",
    "**/.tmp/**",
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/coverage/**",
    "**/*.md",
    "packages/*/fixtures/**",
  ],
  rules: {
    // ═══════════════════════════════════════════════════════════════
    // UNIVERSAL QUALITY GATES (error) — fail CI; do not demote
    // ═══════════════════════════════════════════════════════════════
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/await-thenable": "error",
    "typescript/only-throw-error": "error",
    "typescript/no-for-in-array": "error",
    "typescript/no-implied-eval": "error",
    "prefer-promise-reject-errors": "error",
    "typescript/prefer-promise-reject-errors": "error",
    // Strict equality except idiomatic == null / != null
    eqeqeq: ["error", "always", { null: "ignore" }],
    "no-eq-null": "off",

    // ═══════════════════════════════════════════════════════════════
    // NOT QUALITY GATES (off) — style / metrics / preference
    // ═══════════════════════════════════════════════════════════════
    "func-style": "off",
    "func-names": "off",
    "sort-keys": "off",
    complexity: "off",
    "max-classes-per-file": "off",
    "max-nested-callbacks": "off",
    "no-inline-comments": "off",
    "no-use-before-define": "off",
    "require-unicode-regexp": "off",
    "prefer-named-capture-group": "off",
    "typescript/consistent-type-definitions": "off",
    "typescript/method-signature-style": "off",
    "typescript/array-type": "off",
    "typescript/consistent-type-imports": "off",
    "typescript/consistent-type-exports": "off",
    "import/consistent-type-specifier-style": "off",
    "prefer-destructuring": "off",
    "prefer-template": "off",
    "no-plusplus": "off",
    "no-else-return": "off",
    "no-lonely-if": "off",
    "no-negated-condition": "off",
    "no-empty": "off",
    "default-case": "off",
    "unicorn/no-negated-condition": "off",
    "unicorn/no-array-sort": "off",
    "unicorn/prefer-spread": "off",
    "unicorn/no-await-expression-member": "off",
    "unicorn/no-immediate-mutation": "off",
    "unicorn/prefer-ternary": "off",
    "unicorn/prefer-number-properties": "off",
    "unicorn/prefer-number-coercion": "off",
    "unicorn/prefer-string-slice": "off",
    "unicorn/prefer-string-replace-all": "off",
    "unicorn/prefer-string-starts-ends-with": "off",
    "unicorn/prefer-logical-operator-over-ternary": "off",
    "unicorn/prefer-single-call": "off",
    "unicorn/prefer-module": "off",
    "unicorn/prefer-node-protocol": "off",
    "unicorn/prefer-import-meta-properties": "off",
    "unicorn/prefer-event-target": "off",
    "unicorn/no-useless-undefined": "off",
    "unicorn/explicit-length-check": "off",
    "unicorn/prefer-optional-catch-binding": "off",
    "unicorn/no-null": "off",
    "unicorn/switch-case-braces": "off",
    "unicorn/catch-error-name": "off",
    "unicorn/import-style": "off",
    "unicorn/no-lonely-if": "off",
    "unicorn/consistent-template-literal-escape": "off",
    "oxc/no-barrel-file": "off",
    "oxc/branches-sharing-code": "off",
    // Stricli command handlers use `this: ContenzContext`; helpers take ctx arg.
    "oxc/no-this-in-exported-function": "off",
    "promise/avoid-new": "off",
    "jsdoc/require-param-description": "off",
    "jsdoc/require-returns-description": "off",
    "jsdoc/check-tag-names": "off",
    "node/global-require": "off",
    // React component filenames often PascalCase; not a quality signal.
    "unicorn/filename-case": "off",
    // Broken / pedantic DOM prefs vs current TS lib.dom overloads.
    "unicorn/prefer-dom-node-append": "off",
    // Autofix often breaks local re-export barrels.
    "unicorn/prefer-export-from": "off",
    // Braces-only style — not a defect (Ultracite default error).
    curly: "off",

    // ═══════════════════════════════════════════════════════════════
    // QUALITY DEBT (warn) — real issues, gradual; not silent
    // Prefer fixing over demoting further. CI may later --max-warnings=0.
    // ═══════════════════════════════════════════════════════════════
    "typescript/strict-boolean-expressions": "warn",
    "typescript/no-unsafe-assignment": "warn",
    "typescript/no-unsafe-member-access": "warn",
    "typescript/no-unsafe-call": "warn",
    "typescript/no-unsafe-argument": "warn",
    "typescript/no-unsafe-return": "warn",
    "typescript/no-unsafe-type-assertion": "warn",
    "typescript/no-explicit-any": "warn",
    "typescript/no-non-null-assertion": "warn",
    "typescript/prefer-nullish-coalescing": "warn",
    "typescript/return-await": "warn",
    "typescript/no-deprecated": "warn",
    "typescript/no-unnecessary-type-assertion": "warn",
    "typescript/restrict-template-expressions": "warn",
    "typescript/no-redundant-type-constituents": "warn",
    "typescript/prefer-regexp-exec": "warn",
    "typescript/switch-exhaustiveness-check": "warn",
    "typescript/prefer-string-starts-ends-with": "warn",
    "typescript/no-unnecessary-type-parameters": "warn",
    "typescript/no-dynamic-delete": "warn",
    "typescript/no-base-to-string": "warn",
    "typescript/strict-void-return": "warn",
    "typescript/non-nullable-type-assertion-style": "warn",
    "typescript/no-unnecessary-type-conversion": "warn",
    "typescript/no-unnecessary-boolean-literal-compare": "warn",
    "typescript/no-misused-spread": "warn",
    "typescript/consistent-return": "warn",
    "no-await-in-loop": "warn",
    "require-await": "warn",
    "typescript/promise-function-async": "warn",
    "no-nested-ternary": "warn",
    "unicorn/no-nested-ternary": "warn",
    "no-unused-vars": "warn",
    "no-loop-func": "warn",
  },
  overrides: [
    {
      files: [
        "**/encoding.ts",
        "**/encoding.mts",
        "**/encoding.cts",
        "**/*crypto*.ts",
        "**/*crypto*.tsx",
        "**/suites/webcrypto.ts",
        "**/packages/crypto/**/*.{ts,tsx}",
        "**/packages/kernel/**/*.{ts,tsx}",
      ],
      rules: {
        // Timing-safe compares / crypto bit ops are intentional.
        "no-bitwise": "off",
      },
    },
    {
      files: [
        "**/scripts/**/*.{js,mjs,cjs,ts}",
        "**/deploy.mjs",
        "**/e2e/**/*.{js,mjs,cjs,ts}",
      ],
      rules: {
        "no-console": "off",
        "unicorn/no-process-exit": "off",
        // Untyped tooling JS: type-aware rules cannot pass without a program.
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-type-assertion": "off",
        "typescript/strict-boolean-expressions": "off",
      },
    },
    {
      files: [
        "**/*.{test,spec}.{ts,tsx}",
        "**/__tests__/**/*.{ts,tsx}",
        "**/src/**/test/**/*.{ts,tsx}",
        "**/packages/**/testing/**/*.{ts,tsx}",
      ],
      rules: {
        "typescript/no-non-null-assertion": "off",
        "typescript/no-unsafe-type-assertion": "warn",
      },
    },
  ],
});
