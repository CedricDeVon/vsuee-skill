import { cpSync } from "node:fs";
import path from "node:path";

import { getScriptName } from "./utility.mjs";

const scriptName = getScriptName(import.meta.url)
const [outputPath, ...inputPaths] = process.argv.slice(2);

if (!outputPath || !inputPaths.length) {
    throw new Error(
        `Usage: node ${scriptName} <outputPath> <inputPath> [...]`,
    );
}

for (const inputPath of inputPaths) {
    cpSync(
        inputPath,
        path.join(outputPath,
        path.basename(inputPath)
    ),
        {
            recursive: true,
        },
    );
}
