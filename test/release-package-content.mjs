import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const inputPath = process.argv[2];

if (!inputPath) {
    throw new Error("Input tarball path is required.");
}

const tarballPath = path.resolve(inputPath);
const tarball = gunzipSync(readFileSync(tarballPath));

const expectedFiles = new Set([
    "package/LICENSE",
    "package/package.json",
    "package/plugin.json",
    "package/README.md",
    "package/skills/vsuee/SKILL.md",
    "package/lib/browser-runner.mjs",
    "package/lib/moodle-client.mjs",
    "package/lib/sync-manager.mjs",
    "package/bin/vsuee.mjs",
]);

const files = [];
for (let offset = 0; offset + 512 <= tarball.length;) {
    const header = tarball.subarray(offset, offset + 512);
    offset += 512;

    if (header.every((byte) => byte === 0)) {
        break;
    }

    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const entryName = prefix ? `${prefix}/${name}` : name;
    const sizeText = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim();
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
    const type = header[156];

    if (type === 0 || type === 48) {
        files.push(entryName);
    }

    offset += Math.ceil(size / 512) * 512;
}

const actualFiles = new Set(files);
const missingFiles = [...expectedFiles].filter((file) => !actualFiles.has(file));
const unexpectedFiles = [...actualFiles].filter((file) => !expectedFiles.has(file));

if (missingFiles.length > 0 || unexpectedFiles.length > 0 || files.length !== expectedFiles.size) {
    const details = [
        missingFiles.length > 0 ? `Missing files:\n${missingFiles.join("\n")}` : "",
        unexpectedFiles.length > 0 ? `Unexpected files:\n${unexpectedFiles.join("\n")}` : "",
        files.length !== expectedFiles.size ? `Expected ${expectedFiles.size} files, found ${files.length}.` : "",
    ].filter(Boolean);

    console.error(details.join("\n"));
    process.exit(1);
}
