import path from "node:path";
import { existsSync, readdirSync, renameSync } from "node:fs";

import { getScriptName } from "./utility.mjs";

const [basePath, ...arguments_] = process.argv.slice(2);
const scriptName = getScriptName(import.meta.url)

if (
    !basePath ||
    (!arguments_.length || arguments_.length % 2 !== 0) ||
    !existsSync(basePath)
) {
    throw new Error(
        `Usage: node ${scriptName} <basePath> <sourcePath> <destinationPath> [...]`,
    );
}

for (let index = 0; index < arguments_.length; index += 2) {
    const sourcePath = arguments_[index];
    const destinationPaths = path.join(basePath, arguments_[index + 1]);

    const sourcePaths = readdirSync(basePath).filter((entry) => {
        if (!sourcePath.includes("*")) {
            return entry === sourcePath;
        }

        const filesystemPattern = new RegExp(
            `^${sourcePath
                .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
                .replace(/\*/g, ".*")}$`,
        );

        return filesystemPattern.test(entry);
    });

    if (sourcePaths.length !== 1) {
        throw new Error(
            `Expected exactly one match for filesystem path '${sourcePath}', found ${sourcePaths.length}.`,
        );
    }

    renameSync(
        path.join(basePath, sourcePaths[0]),
        destinationPaths,
    );
}
