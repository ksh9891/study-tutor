import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { installStepArtifacts, installTutorProject } from "../pack/installer.js";
import { loadTutorPack } from "../pack/loader.js";

function repositoryRootFromTestFile() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function bundledPackRoot() {
  return join(repositoryRootFromTestFile(), "packs", "jpa-tutor-pack");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("installTutorProject", () => {
  it("creates a new Java study project with step 01 artifacts", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-install-"));
    const pack = await loadTutorPack(bundledPackRoot());
    const projectRoot = join(workspace, "mini-jpa-study");

    await installTutorProject({
      pack,
      projectRoot,
      courseId: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });

    await expect(exists(join(projectRoot, "build.gradle"))).resolves.toBe(true);
    await expect(exists(join(projectRoot, ".tutor", "progress.json"))).resolves.toBe(true);
    await expect(exists(join(projectRoot, ".tutor", "pack.lock"))).resolves.toBe(true);
    await expect(exists(join(projectRoot, ".tutor", "steps", "step-01-entity-annotations", "requirements.md"))).resolves.toBe(true);
    await expect(exists(join(projectRoot, ".tutor", "steps", "step-01-entity-annotations", "tck-tests"))).resolves.toBe(true);
    await expect(exists(join(projectRoot, "src", "test", "java", "publictests", "step01", "EntityAnnotationSanityTest.java"))).resolves.toBe(true);
    expect((await stat(join(projectRoot, "gradlew"))).mode & 0o111).toBeGreaterThan(0);

    const progress = JSON.parse(await readFile(join(projectRoot, ".tutor", "progress.json"), "utf8"));
    expect(progress).toMatchObject({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      currentStep: "step-01-entity-annotations",
      completedSteps: []
    });

    const packLock = YAML.parse(await readFile(join(projectRoot, ".tutor", "pack.lock"), "utf8"));
    expect(packLock).toEqual({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });
  });

  it("refuses to install into an existing directory", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-install-conflict-"));
    const pack = await loadTutorPack(bundledPackRoot());
    await mkdir(join(workspace, "mini-jpa-study"));

    await expect(installTutorProject({
      pack,
      projectRoot: join(workspace, "mini-jpa-study"),
      courseId: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    })).rejects.toThrow("Install target already exists");
  });

  it.each(["jpa-concepts-practice", "missing-course"])("rejects non-active course id %s", async (courseId) => {
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-install-course-"));
    const pack = await loadTutorPack(bundledPackRoot());

    await expect(installTutorProject({
      pack,
      projectRoot: join(workspace, "mini-jpa-study"),
      courseId,
      source: "bundled:packs/jpa-tutor-pack"
    })).rejects.toThrow(`Unknown active course ${courseId}`);
  });

  it("removes a newly-created project root when installation fails after template copy", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-install-rollback-"));
    const pack = await loadTutorPack(bundledPackRoot());
    const projectRoot = join(workspace, "mini-jpa-study");
    const brokenPack = {
      ...pack,
      metadata: {
        ...pack.metadata,
        initialStep: "step-99-missing"
      }
    };

    await expect(installTutorProject({
      pack: brokenPack,
      projectRoot,
      courseId: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    })).rejects.toThrow("Unknown step step-99-missing");
    await expect(exists(projectRoot)).resolves.toBe(false);
  });
});

describe("installStepArtifacts", () => {
  it("installs step 02 public tests into the step02 publictests package", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-step-install-"));
    const pack = await loadTutorPack(bundledPackRoot());
    const projectRoot = join(workspace, "mini-jpa-study");

    await installTutorProject({
      pack,
      projectRoot,
      courseId: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });
    await installStepArtifacts(pack, projectRoot, "step-02-entity-metadata");

    await expect(exists(join(projectRoot, "src", "test", "java", "publictests", "step02", "EntityMetadataSanityTest.java"))).resolves.toBe(true);
  });

  it("rolls back step artifacts when public test copy fails so retry can succeed", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-step-rollback-"));
    const pack = await loadTutorPack(bundledPackRoot());
    const projectRoot = join(workspace, "mini-jpa-study");
    const stepId = "step-02-entity-metadata";
    const stepRequirements = join(projectRoot, ".tutor", "steps", stepId, "requirements.md");
    const publicTestTarget = join(projectRoot, "src", "test", "java", "publictests", "step02");
    const publicTestConflict = join(publicTestTarget, "EntityMetadataSanityTest.java");

    await installTutorProject({
      pack,
      projectRoot,
      courseId: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });
    await mkdir(publicTestTarget, { recursive: true });
    await writeFile(publicTestConflict, "conflict");

    await expect(installStepArtifacts(pack, projectRoot, stepId)).rejects.toThrow("Refusing to overwrite existing files");
    await expect(exists(stepRequirements)).resolves.toBe(false);

    await rm(publicTestConflict);
    await installStepArtifacts(pack, projectRoot, stepId);

    await expect(exists(stepRequirements)).resolves.toBe(true);
    await expect(exists(publicTestConflict)).resolves.toBe(true);
  });
});
