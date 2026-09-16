import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

import { getNpmCli } from "../scripts/utility.mjs";

const [, , packagePathArgument, ...unexpectedArguments] = process.argv;

if (!packagePathArgument || unexpectedArguments.length > 0) {
    console.error(
        "Usage: node local-installation.mjs <package-path>",
    );
    process.exit(1);
}

const packagePath = resolve(packagePathArgument);
await access(packagePath);

const installationDirectory = await mkdtemp(
    join(tmpdir(), "vsuee-skill-install-"),
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

try {
    await writeFile(
        join(installationDirectory, ".npmrc"),
        "allow-scripts=vsuee-skill\n",
        "utf8",
    );

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
} finally {
    await rm(installationDirectory, {
        recursive: true,
        force: true,
    });
}
