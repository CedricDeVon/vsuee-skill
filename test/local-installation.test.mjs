import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const [, , installationDirectoryArgument, packagePathArgument] =
    process.argv;

if (!installationDirectoryArgument || !packagePathArgument) {
    console.error(
        "Usage: node local-installation.test.mjs <installation-directory> <package-path>",
    );
    process.exit(1);
}

const installationDirectory = resolve(installationDirectoryArgument);
const packagePath = resolve(packagePathArgument);

await rm(installationDirectory, {
    recursive: true,
    force: true,
});

await mkdir(installationDirectory, {
    recursive: true,
});

const run = (command, args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: "inherit",
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });

await run("npm", ["init", "--yes"], {
  cwd: installationDirectory,
});

await run("npm", ["install", packagePath], {
  cwd: installationDirectory,
});
