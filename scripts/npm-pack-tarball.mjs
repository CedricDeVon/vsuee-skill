import { spawnSync } from "node:child_process";

import { getNpmCli, getScriptName } from "./utility.mjs";

const scriptName = getScriptName(import.meta.url)
const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
    throw new Error(
        `Usage: node ${scriptName} <inputPath> <outputPath>`,
    );
}

const result = spawnSync(
    getNpmCli(),
    [
        "pack",
        inputPath,
        "--pack-destination",
        outputPath,
    ],
    {
        stdio: "inherit",
    },
);

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 1);
