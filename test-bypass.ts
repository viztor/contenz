import path from "node:path";
import { resolveUnderCwd } from "./packages/cli/src/commands/init-path.ts";

function testBypass(cwd: string, input: string) {
    const orig = resolveUnderCwd(cwd, input, path.win32);
    console.log(`Input: ${input} ->`, orig);
}

// Memory rule says:
// When fixing path traversal vulnerabilities by introducing path normalization (e.g., path.posix.normalize()), ensure that *all* subsequent boundary checks (e.g., strict equality tests !== "." and !== "..", as well as absolute path checks) are evaluated against the newly normalized path variable, not the original input value. Failing to update these checks leaves the function vulnerable to bypassing (e.g., with paths like foo/../.. or Windows paths like foo/../\windows avoiding initial checks).
// Where is `path.posix.normalize` used? Ah, it's used in `packages/core/src/sources.ts`!

// Wait, the memory rule says:
// "When fixing path traversal vulnerabilities by introducing path normalization (e.g., path.posix.normalize()), ensure that *all* subsequent boundary checks (e.g., strict equality tests !== "." and !== "..", as well as absolute path checks) are evaluated against the newly normalized path variable, not the original input value. Failing to update these checks leaves the function vulnerable to bypassing (e.g., with paths like foo/../.. or Windows paths like foo/../\windows avoiding initial checks)."
// Let's check packages/core/src/sources.ts again.
