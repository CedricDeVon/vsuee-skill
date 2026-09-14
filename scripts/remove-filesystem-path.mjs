import { rmSync } from "node:fs";

const inputPath = process.argv[2];

if (!inputPath) {
    throw new Error("Input path is required.");
}

rmSync(inputPath, {
    recursive: true,
    force: true,
});
