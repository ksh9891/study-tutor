import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
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
  it("installs from npm pack and resolves the bundled pack", async () => {
    const repositoryRoot = repositoryRootFromTestFile();
    const cliRoot = join(repositoryRoot, "apps", "cli");
    const packDestination = await mkdtemp(join(tmpdir(), "study-tutor-npm-pack-"));
    const extractDestination = await mkdtemp(join(tmpdir(), "study-tutor-npm-pack-extract-"));
    const installDestination = await mkdtemp(join(tmpdir(), "study-tutor-npm-install-"));
    const studyProject = await mkdtemp(join(tmpdir(), "study-tutor-npm-project-"));

    const { stdout } = await execFileAsync("npm", ["pack", "--json", "--pack-destination", packDestination], {
      cwd: cliRoot,
      maxBuffer: 1024 * 1024 * 10
    });
    const [packResult] = parseNpmPackJson(stdout);
    const packedPaths = packResult.files.map((file) => file.path);
    expect(packedPaths).toContain("dist/index.js");
    expect(packedPaths).toContain("dist/packs/jpa-tutor-pack/pack.yaml");
    expect(packedPaths).toContain("dist/packs/jpa-tutor-pack/steps/step-01-entity-annotations/requirements.md");
    expect(packedPaths).toContain("dist/node_modules/@study-tutor/core/package.json");
    expect(packedPaths).toContain("dist/node_modules/@study-tutor/core/dist/index.js");
    expect(packedPaths.some((path) => path.includes("/__tests__/"))).toBe(false);
    expect(packedPaths.some((path) => path.endsWith(".tsbuildinfo"))).toBe(false);

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

    await execFileAsync("npm", ["install", tarball, "--no-audit", "--no-fund"], {
      cwd: installDestination,
      maxBuffer: 1024 * 1024 * 10
    });

    const binPath = join(installDestination, "node_modules", ".bin", process.platform === "win32" ? "study-tutor.cmd" : "study-tutor");
    const { stdout: versionOutput } = await execFileAsync(binPath, ["--version"], {
      cwd: studyProject,
      maxBuffer: 1024 * 1024 * 10
    });
    expect(versionOutput.trim()).toBe("0.1.0");

    await mkdir(join(studyProject, ".tutor"), { recursive: true });
    await writeFile(join(studyProject, ".tutor", "progress.json"), `${JSON.stringify({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      currentStep: "step-01-entity-annotations",
      completedSteps: []
    }, null, 2)}\n`);
    await writeFile(join(studyProject, ".tutor", "pack.lock"), [
      "pack: jpa-tutor-pack",
      "version: 0.1.0",
      "course: mini-hibernate",
      "source:",
      "  type: bundled",
      "  path: packs/jpa-tutor-pack",
      ""
    ].join("\n"));

    const { stdout: statusOutput } = await execFileAsync(binPath, ["status"], {
      cwd: studyProject,
      maxBuffer: 1024 * 1024 * 10
    });
    expect(statusOutput).toContain("Course: Mini Hibernate로 배우는 JPA");
  }, 60_000);
});
