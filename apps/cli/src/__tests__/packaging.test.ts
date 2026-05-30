import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

function repositoryRootFromTestFile() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

interface NpmPackFile {
  path: string;
}

interface NpmPackResult {
  filename: string;
  files: NpmPackFile[];
}

function parseNpmPackJson(stdout: string): NpmPackResult[] {
  const match = stdout.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/);
  if (!match) {
    throw new Error(`Could not parse npm pack JSON from output:\n${stdout}`);
  }
  return JSON.parse(match[1]) as NpmPackResult[];
}

describe("packaged CLI", () => {
  it("includes the bundled pack and resolves it from dist", async () => {
    const repositoryRoot = repositoryRootFromTestFile();
    const cliRoot = join(repositoryRoot, "apps", "cli");
    const packDestination = await mkdtemp(join(tmpdir(), "study-tutor-npm-pack-"));
    const extractDestination = await mkdtemp(join(tmpdir(), "study-tutor-npm-pack-extract-"));

    const { stdout } = await execFileAsync("npm", ["pack", "--json", "--pack-destination", packDestination], {
      cwd: cliRoot,
      maxBuffer: 1024 * 1024 * 10
    });
    const [packResult] = parseNpmPackJson(stdout);
    const packedPaths = packResult.files.map((file) => file.path);
    expect(packedPaths).toContain("dist/index.js");
    expect(packedPaths).toContain("dist/packs/jpa-tutor-pack/pack.yaml");
    expect(packedPaths).toContain("dist/packs/jpa-tutor-pack/steps/step-01-entity-annotations/requirements.md");

    const tarball = join(packDestination, packResult.filename);
    await execFileAsync("tar", ["-xzf", tarball, "-C", extractDestination], {
      maxBuffer: 1024 * 1024 * 10
    });

    const packagedPathsModule = pathToFileURL(join(extractDestination, "package", "dist", "paths.js")).href;
    const { stdout: resolvedPackRoot } = await execFileAsync(process.execPath, [
      "--input-type=module",
      "-e",
      [
        `import { bundledPackRoot } from ${JSON.stringify(packagedPathsModule)};`,
        "console.log(bundledPackRoot('jpa-tutor-pack'));"
      ].join("\n")
    ]);

    const expectedPackRoot = join(extractDestination, "package", "dist", "packs", "jpa-tutor-pack");
    await expect(realpath(resolvedPackRoot.trim())).resolves.toBe(await realpath(expectedPackRoot));
    await expect(readFile(join(expectedPackRoot, "pack.yaml"), "utf8")).resolves.toContain("id: jpa-tutor-pack");
  });
});
