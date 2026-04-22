import { runBuild } from "./packages/core/src/run-build.ts";
import { prepareFixture } from "./packages/core/src/test-fixtures.ts";

async function main() {
    const cwd = await prepareFixture("minimal");
    console.log(cwd);
    const result = await runBuild({ cwd });
    console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
