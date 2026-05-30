import { cp, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { installTutorProject } from "../pack/installer.js";
import { loadTutorPack } from "../pack/loader.js";
import { advanceToNextStep } from "../steps/step-service.js";
import { runGradleTest } from "../test/gradle-runner.js";

function repositoryRootFromTestFile() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

describe("Phase 1 smoke flow", () => {
  it("installs step 01, runs tests, and advances to step 02", async () => {
    const repositoryRoot = repositoryRootFromTestFile();
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-e2e-"));
    const projectRoot = join(workspace, "mini-jpa-study");
    const pack = await loadTutorPack(join(repositoryRoot, "packs", "jpa-tutor-pack"));

    await installTutorProject({
      pack,
      projectRoot,
      courseId: "mini-hibernate",
      source: {
        type: "bundled",
        path: "packs/jpa-tutor-pack"
      }
    });
    await cp(join(repositoryRoot, "examples", "fixtures", "step01-solution", "src"), join(projectRoot, "src"), {
      recursive: true
    });

    const testResult = await runGradleTest(projectRoot);
    expect(testResult.ok, testResult.output).toBe(true);

    const nextResult = await advanceToNextStep({ projectRoot, pack });
    expect(nextResult.nextStep?.id).toBe("step-02-entity-metadata");

    const progress = JSON.parse(await readFile(join(projectRoot, ".tutor", "progress.json"), "utf8"));
    expect(progress.currentStep).toBe("step-02-entity-metadata");
    expect(progress.completedSteps).toEqual(["step-01-entity-annotations"]);
  }, 120_000);
});
