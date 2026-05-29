import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadTutorPack } from "../pack/loader.js";
import { writeProgress } from "../progress/progress-store.js";
import { advanceToNextStep } from "../steps/step-service.js";

function repositoryRootFromTestFile() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

async function createProjectAtStep(stepId = "step-01-entity-annotations") {
  const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-next-"));
  await mkdir(join(projectRoot, ".tutor", "steps", stepId), { recursive: true });
  await mkdir(join(projectRoot, "src", "test", "java", "learner"), { recursive: true });
  await writeProgress(projectRoot, {
    pack: "jpa-tutor-pack",
    version: "0.1.0",
    course: "mini-hibernate",
    currentStep: stepId,
    completedSteps: []
  });
  return projectRoot;
}

async function writeLearnerTest(projectRoot: string) {
  await writeFile(join(projectRoot, "src", "test", "java", "learner", "EntityAnnotationTest.java"), "class EntityAnnotationTest {}");
}

async function readProgressFile(projectRoot: string) {
  return JSON.parse(await readFile(join(projectRoot, ".tutor", "progress.json"), "utf8"));
}

describe("advanceToNextStep", () => {
  it("fails when no learner test exists", async () => {
    const projectRoot = await createProjectAtStep();
    const pack = await loadTutorPack(join(repositoryRootFromTestFile(), "packs", "jpa-tutor-pack"));

    await expect(advanceToNextStep({
      projectRoot,
      pack,
      runGradle: async () => ({ ok: true, output: "BUILD SUCCESSFUL" }),
      runTck: async () => ({ ok: true, output: "BUILD SUCCESSFUL", failedEdgeCases: [] })
    })).rejects.toThrow("Write at least one learner test");
  });

  it("runs tests and TCK, installs next step, and updates progress", async () => {
    const projectRoot = await createProjectAtStep();
    await writeLearnerTest(projectRoot);
    const pack = await loadTutorPack(join(repositoryRootFromTestFile(), "packs", "jpa-tutor-pack"));
    const calls: string[] = [];

    const result = await advanceToNextStep({
      projectRoot,
      pack,
      runGradle: async () => {
        calls.push("gradle");
        return { ok: true, output: "BUILD SUCCESSFUL" };
      },
      runTck: async () => {
        calls.push("tck");
        return { ok: true, output: "BUILD SUCCESSFUL", failedEdgeCases: [] };
      }
    });

    expect(calls).toEqual(["gradle", "tck"]);
    expect(result.nextStep?.id).toBe("step-02-entity-metadata");
    const progress = await readProgressFile(projectRoot);
    expect(progress.completedSteps).toEqual(["step-01-entity-annotations"]);
    expect(progress.currentStep).toBe("step-02-entity-metadata");
  });

  it("does not update progress when Gradle tests fail", async () => {
    const projectRoot = await createProjectAtStep();
    await writeLearnerTest(projectRoot);
    const pack = await loadTutorPack(join(repositoryRootFromTestFile(), "packs", "jpa-tutor-pack"));

    await expect(advanceToNextStep({
      projectRoot,
      pack,
      runGradle: async () => ({ ok: false, output: "gradle failure output" }),
      runTck: async () => {
        throw new Error("TCK should not run after Gradle failure");
      }
    })).rejects.toThrow("Gradle tests failed");

    await expect(readProgressFile(projectRoot)).resolves.toMatchObject({
      currentStep: "step-01-entity-annotations",
      completedSteps: []
    });
  });

  it("does not update progress when TCK checks fail", async () => {
    const projectRoot = await createProjectAtStep();
    await writeLearnerTest(projectRoot);
    const pack = await loadTutorPack(join(repositoryRootFromTestFile(), "packs", "jpa-tutor-pack"));

    await expect(advanceToNextStep({
      projectRoot,
      pack,
      runGradle: async () => ({ ok: true, output: "BUILD SUCCESSFUL" }),
      runTck: async () => ({
        ok: false,
        output: "tck failure output",
        failedEdgeCases: []
      })
    })).rejects.toThrow("TCK checks failed");

    await expect(readProgressFile(projectRoot)).resolves.toMatchObject({
      currentStep: "step-01-entity-annotations",
      completedSteps: []
    });
  });

  it("does not update progress when installing the next step fails", async () => {
    const projectRoot = await createProjectAtStep();
    await writeLearnerTest(projectRoot);
    const pack = await loadTutorPack(join(repositoryRootFromTestFile(), "packs", "jpa-tutor-pack"));
    const publicTestConflict = join(
      projectRoot,
      "src",
      "test",
      "java",
      "publictests",
      "step02",
      "EntityMetadataSanityTest.java"
    );
    await mkdir(dirname(publicTestConflict), { recursive: true });
    await writeFile(publicTestConflict, "conflict");

    await expect(advanceToNextStep({
      projectRoot,
      pack,
      runGradle: async () => ({ ok: true, output: "BUILD SUCCESSFUL" }),
      runTck: async () => ({ ok: true, output: "BUILD SUCCESSFUL", failedEdgeCases: [] })
    })).rejects.toMatchObject({
      message: "Refusing to overwrite existing files",
      details: [publicTestConflict]
    });

    await expect(readProgressFile(projectRoot)).resolves.toMatchObject({
      currentStep: "step-01-entity-annotations",
      completedSteps: []
    });
  });
});
