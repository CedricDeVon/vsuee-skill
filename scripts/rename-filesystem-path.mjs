import { existsSync, readdirSync, renameSync } from "node:fs";
import path from "node:path";

const [basePath, ...arguments_] = process.argv.slice(2);

if (!basePath) {
    throw new Error("Base path is required.");
}

if (arguments_.length === 0 || arguments_.length % 2 !== 0) {
    throw new Error(
        "Usage: node rename.mjs <base-path> <source> <destination> [...]",
    );
}

if (!existsSync(basePath)) {
    throw new Error(`Base path does not exist: ${basePath}.`);
}

for (let index = 0; index < arguments_.length; index += 2) {
    const sourcePattern = arguments_[index];
    const destination = path.join(basePath, arguments_[index + 1]);

    const sources = readdirSync(basePath).filter((entry) => {
        if (!sourcePattern.includes("*")) {
            return entry === sourcePattern;
        }

        const pattern = new RegExp(
            `^${sourcePattern
                .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
                .replace(/\*/g, ".*")}$`,
        );

        return pattern.test(entry);
    });

    if (sources.length !== 1) {
        throw new Error(
            `Expected exactly one match for "${sourcePattern}", found ${sources.length}.`,
        );
    }

    renameSync(
        path.join(basePath, sources[0]),
        destination,
    );
}
