import test from 'node:test';
import path from "node:path";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { access, mkdir, readdir, rm } from "node:fs/promises";

import { getScriptName } from "../scripts/utility.mjs";

const [, , installationDirectoryArgument, packagePathArgument, packageName] =
    process.argv;
const scriptName = getScriptName(import.meta.url)

if (!installationDirectoryArgument || !packagePathArgument || !packageName) {
    console.error(
        `Usage: node ${scriptName} <installationDirectory> <packagePath> <packageName>`,
    );
    process.exit(1);
}

test('LocalInstallationTest should locally install a target package, via tarball', async () => {      
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

  const nodeModulesPath = resolve(
      installationDirectory,
      "node_modules",
  );

  const packages = (await readdir(nodeModulesPath, {
      withFileTypes: true,
  }))
      .filter((entry) => entry.isDirectory() && entry.name == packageName)
      .map((entry) => entry.name);

  if (!packages.length || packages.length > 1) {
    throw new Error(
      `Local Installation Test Failed: '${packageName}' has not been installed`
    )
  }

  const installedPackagePath = resolve(
      nodeModulesPath,
      packages[0],
  );

  await access(installedPackagePath);
});

test("LocalInstallationTest should contain all included files and folders specified within the 'package.json' file, from an installed node_modules target package", async () => {      
  const installationDirectory = path.resolve(installationDirectoryArgument);
  const nodeModulesPath = path.resolve(
      installationDirectory,
      "node_modules",
  );
  const inputPath = path.resolve(
    nodeModulesPath,
    packageName
  )  
  const packagePath = path.resolve(inputPath);
  const packageJsonPath = path.join(packagePath, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  
  const missingPaths = packageJson.files.filter(
      (filePath) => !existsSync(path.join(packagePath, filePath)),
  );
  
  if (missingPaths.length > 0) {
    throw new Error(
      `Missing paths:\n${missingPaths.join("\n")}`
    )
  }
})
