import { spawnSync } from "node:child_process";

const scripts = process.argv.slice(2);

if (scripts.length === 0) {
    throw new Error("At least one npm script is required.");
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

for (const script of scripts) {
    const result = spawnSync(
        npm,
        ["run", script],
        {
            stdio: "inherit",
        },
    );

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}