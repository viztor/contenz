1. Modify `packages/core/src/parser.ts` to cache the compiled `RegExp` objects inside `parseFileName`. Re-compiling the regex on every single file parse operation can become a significant bottleneck when reading large content collections. I will use `replace_with_git_merge_diff` to declare a cache Map at the module level and update `parseFileName` to retrieve the cached regex.
2. Verify the changes are correctly formatted and pass lint checks using `pnpm run lint` and `npx oxfmt packages/core/src/parser.ts`.
3. Run `pnpm run build --filter @contenz/core` to build the core package.
4. Run the full test suite `pnpm test` to verify no regressions were introduced.
5. Create a `packages/e2e/fixtures` reset step using `git restore --staged packages/e2e/fixtures/ && git checkout -- packages/e2e/fixtures/`.
6. Log a Bolt journal entry using `cat << 'EOF' >> .jules/bolt.md` reflecting on how regex compilation in hot paths should be cached, format it using `npx oxfmt .jules/bolt.md`, and verify with `cat .jules/bolt.md`.
7. Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
8. Submit the PR with standard Bolt formatting (⚡ Bolt: ...).
