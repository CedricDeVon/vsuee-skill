import path from "node:path";
import { fileURLToPath } from "node:url";

export function getScriptName(importMetaUrl) {
    const scriptPath = fileURLToPath(importMetaUrl);
    return path.basename(scriptPath);
}

export function getNpmCli() {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    return npm;
}


