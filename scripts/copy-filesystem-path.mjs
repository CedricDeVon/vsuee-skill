import { cpSync } from "node:fs";
import path from "node:path";

const [outputPath, ...inputPaths] = process.argv.slice(2);

if (!outputPath) {
    throw new Error("Output path is required.");
}

if (inputPaths.length === 0) {
    throw new Error("At least one input path is required.");
}

for (const inputPath of inputPaths) {
    cpSync(
        inputPath,
        path.join(outputPath, path.basename(inputPath)),
        {
            recursive: true,
        },
    );
}