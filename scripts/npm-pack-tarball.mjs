import { spawnSync } from "node:child_process";

import {
    getNpmCli,
    getScriptName,
    resolveProjectPath,
} from "./utility.mjs";

const scriptName = getScriptName(import.meta.url);
const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
    throw new Error(
        `Usage: node ${scriptName} <inputPath> <outputPath>`,
    );
}

const resolvedInputPath = resolveProjectPath(inputPath);
const resolvedOutputPath = resolveProjectPath(outputPath);

const result = spawnSync(
    getNpmCli(),
    [
        "pack",
        resolvedInputPath,
        "--pack-destination",
        resolvedOutputPath,
    ],
    {
        stdio: "inherit",
    },
);

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 1);
