import { spawnSync } from "node:child_process";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
    throw new Error(
        "Usage: node pack.mjs <input-path> <output-path>.",
    );
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const result = spawnSync(
    npm,
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
