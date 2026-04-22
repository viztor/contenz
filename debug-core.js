import { loadProjectConfig } from "./packages/core/src/config.ts";
import { prepareFixture } from "./packages/core/src/test-fixtures.ts";

async function run() {
    const cwd = await prepareFixture("minimal");
    console.log("CWD", cwd);
    try {
        const config = await loadProjectConfig(cwd);
        console.log("CONFIG", config);
    } catch(e) {
        console.error(e);
    }
}
run();
