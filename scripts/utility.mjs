import path from "node:path";
import { fileURLToPath } from "node:url";

export function getScriptName(importMetaUrl) {
    const scriptPath = fileURLToPath(importMetaUrl);
    return path.basename(scriptPath);
}

export function getNpmCli() {
    return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function resolveProjectPath(inputPath, { allowProjectRoot = false } = {}) {
    if (typeof inputPath !== "string" || inputPath.length === 0) {
        throw new Error("A filesystem path is required.");
    }

    const projectRoot = path.resolve(process.cwd());
    const resolvedPath = path.resolve(projectRoot, inputPath);
    const relativePath = path.relative(projectRoot, resolvedPath);
    const isProjectRoot = relativePath.length === 0;
    const isInsideProject = !isProjectRoot
        && !relativePath.startsWith(`..${path.sep}`)
        && !path.isAbsolute(relativePath);

    if ((!allowProjectRoot && isProjectRoot) || (!isProjectRoot && !isInsideProject)) {
        throw new Error(`Path must remain inside the project workspace: '${inputPath}'.`);
    }

    return resolvedPath;
}

export function assertPathSegment(segment, label = "path segment") {
    if (
        typeof segment !== "string"
        || segment.length === 0
        || segment === "."
        || segment === ".."
        || segment.includes("/")
        || segment.includes("\\")
    ) {
        throw new Error(`Invalid ${label}: '${segment}'.`);
    }

    return segment;
}
