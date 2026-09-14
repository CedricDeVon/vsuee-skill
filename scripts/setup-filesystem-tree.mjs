import { mkdirSync } from "node:fs";

const inputPaths = process.argv.slice(2);

if (inputPaths.length === 0) {
    throw new Error("At least one input path is required.");
}

for (const inputPath of inputPaths) {
    mkdirSync(inputPath, {
        recursive: true,
    });
}