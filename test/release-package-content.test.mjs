import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const inputPath = process.argv[2];

if (!inputPath) {
    throw new Error("Input path is required.");
}

const packagePath = path.resolve(inputPath);
const packageJsonPath = path.join(packagePath, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const missingPaths = packageJson.files.filter(
    (filePath) => !existsSync(path.join(packagePath, filePath)),
);

if (missingPaths.length > 0) {
    console.error(`Missing paths:\n${missingPaths.join("\n")}`);
    process.exit(1);
}
