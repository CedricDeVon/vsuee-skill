import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("publish workflow accepts canonical release tags only", () => {
    const workflow = readFileSync(
        new URL("../.github/workflows/publish.yml", import.meta.url),
        "utf8",
    );

    assert.match(workflow, /tags:\s*\n\s+- "v\*"/);
    assert.doesNotMatch(workflow, /^\s+branches:/m);
    assert.match(workflow, /if: github\.repository == 'M1Vj\/vsuee-skill'/);
    assert.match(workflow, /expected_tag="v\$\{package_version\}"/);
    assert.match(workflow, /git merge-base --is-ancestor "\$RELEASE_SHA" origin\/main/);
    assert.match(
        workflow,
        /npm stage publish \.tmp\/build\/release\/dist\/vsuee-skill\.tgz/,
    );
});

test("release workflows pin third-party actions to immutable commits", () => {
    for (const workflowPath of ["feature.yml", "publish.yml"]) {
        const workflow = readFileSync(
            new URL(`../.github/workflows/${workflowPath}`, import.meta.url),
            "utf8",
        );
        const references = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)]
            .map((match) => match[1]);

        assert.ok(references.length > 0, `${workflowPath} must use actions`);
        for (const reference of references) {
            assert.match(
                reference,
                /^[^@]+@[0-9a-f]{40}$/,
                `${workflowPath} has a mutable action reference: ${reference}`,
            );
        }
    }
});
