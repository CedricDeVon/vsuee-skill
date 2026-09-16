import assert from "node:assert/strict";
import test from "node:test";

import { runScripts } from "../scripts/run-scripts.mjs";

test("staged workflow stops after the first failed script", () => {
    const executed = [];
    const exitCode = runScripts(["fail-release-step", "must-not-run"], {
        spawnSyncImpl(_npm, [, script]) {
            executed.push(script);
            return { status: script === "fail-release-step" ? 17 : 0 };
        },
    });

    assert.equal(exitCode, 17);
    assert.deepEqual(executed, ["fail-release-step"]);
});
