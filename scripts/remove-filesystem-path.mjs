import { rmSync } from "node:fs";

import { getScriptName } from "./utility.mjs";

const inputPath = process.argv[2];
const scriptName = getScriptName(import.meta.url)

if (!inputPath) {
    throw new Error(
        `Usage: node ${scriptName} <inputPath>`,
    );
}

rmSync(
    inputPath, {
    recursive: true,
    force: true,
});
