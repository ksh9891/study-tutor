import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { readProgress, writePackLock, writeProgress } from "../progress/progress-store.js";

describe("progress-store", () => {
  it("writes and reads progress.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-progress-"));
    await mkdir(join(root, ".tutor"));

    await writeProgress(root, {
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      currentStep: "step-01-entity-annotations",
      completedSteps: []
    });

    await expect(readProgress(root)).resolves.toEqual({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      currentStep: "step-01-entity-annotations",
      completedSteps: []
    });
  });

  it("writes pack.lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-lock-"));
    await mkdir(join(root, ".tutor"));

    await writePackLock(root, {
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });

    const progress = YAML.parse(await readFile(join(root, ".tutor", "pack.lock"), "utf8"));
    expect(progress).toEqual({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });
  });

  it("creates .tutor recursively when writing progress.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-progress-create-"));

    await writeProgress(root, {
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      currentStep: "step-01-entity-annotations",
      completedSteps: []
    });

    await expect(readFile(join(root, ".tutor", "progress.json"), "utf8")).resolves.toContain("\"pack\": \"jpa-tutor-pack\"");
  });

  it("creates .tutor recursively when writing pack.lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-lock-create-"));

    await writePackLock(root, {
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });

    await expect(readFile(join(root, ".tutor", "pack.lock"), "utf8")).resolves.toContain("pack: jpa-tutor-pack");
  });

  it("reports the user-facing message when progress.json is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-progress-missing-"));

    await expect(readProgress(root)).rejects.toMatchObject({
      name: "StudyTutorError",
      message: "Could not read .tutor/progress.json. Run this command from a study-tutor project root."
    });
  });

  it("rejects invalid progress schema", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-progress-invalid-"));
    await mkdir(join(root, ".tutor"), { recursive: true });
    await writeFile(join(root, ".tutor", "progress.json"), JSON.stringify({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      currentStep: "step-01-entity-annotations",
      completedSteps: [""]
    }));

    await expect(readProgress(root)).rejects.toMatchObject({
      name: "StudyTutorError",
      message: "Could not read .tutor/progress.json. Run this command from a study-tutor project root.",
      details: [expect.stringContaining("completedSteps")]
    });
  });
});
