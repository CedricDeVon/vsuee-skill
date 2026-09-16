import { mkdirSync } from "node:fs";

import { getScriptName } from "./utility.mjs";

const scriptName = getScriptName(import.meta.url)
const inputPaths = process.argv.slice(2);

if (inputPaths.length === 0) {
    throw new Error(
        `Usage: node ${scriptName} <inputPath> [...]`,
    );
}

for (const inputPath of inputPaths) {
    mkdirSync(inputPath, {
        recursive: true,
    });
}
