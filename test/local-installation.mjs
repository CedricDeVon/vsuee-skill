import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

import { getNpmCli } from "../scripts/utility.mjs";

const [, , installationDirectoryArgument, packagePathArgument] = process.argv;

if (!installationDirectoryArgument || !packagePathArgument) {
    console.error(
        "Usage: node local-installation.mjs <installation-directory> <package-path>",
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

await writeFile(
    join(installationDirectory, ".npmrc"),
    "allow-scripts=vsuee-skill\n",
    "utf8",
);

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

const npmCli = getNpmCli();
const npmEnvironment = { ...process.env };
delete npmEnvironment.npm_config_allow_scripts;
delete npmEnvironment.NPM_CONFIG_ALLOW_SCRIPTS;

await run(npmCli, ["init", "--yes"], {
    cwd: installationDirectory,
    env: npmEnvironment,
});

await run(npmCli, ["install", "--ignore-scripts", packagePath], {
    cwd: installationDirectory,
    env: npmEnvironment,
});

await run(npmCli, ["exec", "--offline", "--", "vsuee", "--help"], {
    cwd: installationDirectory,
    env: npmEnvironment,
});
