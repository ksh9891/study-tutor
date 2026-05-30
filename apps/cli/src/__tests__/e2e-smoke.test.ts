import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { installTutorProject, loadTutorPack } from "@study-tutor/core";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

function repositoryRootFromTestFile() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

async function runCli(repositoryRoot: string, projectRoot: string, args: string[]) {
  return execFileAsync(process.execPath, [join(repositoryRoot, "apps", "cli", "dist", "index.js"), ...args], {
    cwd: projectRoot,
    maxBuffer: 1024 * 1024 * 10,
    timeout: 120_000
  });
}

describe("CLI binary smoke flow", () => {
  it("runs status, test, and next from the generated project cwd", async () => {
    const repositoryRoot = repositoryRootFromTestFile();
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-cli-e2e-"));
    const projectRoot = join(workspace, "mini-jpa-study");
    const pack = await loadTutorPack(join(repositoryRoot, "packs", "jpa-tutor-pack"));

    await installTutorProject({
      pack,
      projectRoot,
      courseId: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });
    await cp(join(repositoryRoot, "examples", "fixtures", "step01-solution", "src"), join(projectRoot, "src"), {
      recursive: true
    });

    const statusResult = await runCli(repositoryRoot, projectRoot, ["status"]);
    expect(statusResult.stdout).toContain("Current Step: 01 - Entity Annotation 만들기");
    expect(statusResult.stdout).toContain("Next action:");

    const testResult = await runCli(repositoryRoot, projectRoot, ["test"]);
    expect(testResult.stdout).toContain("BUILD SUCCESSFUL");

    const nextResult = await runCli(repositoryRoot, projectRoot, ["next"]);
    expect(nextResult.stdout).toContain("Step completed: Entity Annotation 만들기");
    expect(nextResult.stdout).toContain("Next step created: EntityMetadata 추출하기");

    const progress = JSON.parse(await readFile(join(projectRoot, ".tutor", "progress.json"), "utf8"));
    expect(progress.currentStep).toBe("step-02-entity-metadata");
    expect(progress.completedSteps).toEqual(["step-01-entity-annotations"]);
  }, 180_000);
});
