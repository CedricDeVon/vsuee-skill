import { spawnSync } from "node:child_process";

import { getNpmCli, getScriptName } from "./utility.mjs";

const scripts = process.argv.slice(2);
const scriptName = getScriptName(import.meta.url)

if (!scripts.length) {    
    throw new Error(
        `Usage: node ${scriptName} <script> [...]`,
    );
}

for (const script of scripts) {
    const result = spawnSync(
        getNpmCli(),
        ["run", script],
        {
            stdio: "inherit",
        },
    );

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}