import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { readPackLock, readProgress, writePackLock, writeProgress } from "../progress/progress-store.js";

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

  it("writes pack.lock with bundled source object", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-lock-bundled-object-"));
    await mkdir(join(root, ".tutor"));

    await writePackLock(root, {
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: {
        type: "bundled",
        path: "packs/jpa-tutor-pack"
      }
    });

    const lock = YAML.parse(await readFile(join(root, ".tutor", "pack.lock"), "utf8"));
    expect(lock.source).toEqual({
      type: "bundled",
      path: "packs/jpa-tutor-pack"
    });
  });

  it("reads legacy string source as bundled-compatible pack.lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-lock-legacy-read-"));
    await mkdir(join(root, ".tutor"), { recursive: true });
    await writeFile(join(root, ".tutor", "pack.lock"), YAML.stringify({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    }));

    await expect(readPackLock(root)).resolves.toEqual({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });
  });

  it("reads registry source object from pack.lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-lock-registry-read-"));
    await mkdir(join(root, ".tutor"), { recursive: true });
    await writeFile(join(root, ".tutor", "pack.lock"), YAML.stringify({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/marketplace.git",
        packRepo: "https://github.com/me/jpa-tutor-pack.git",
        ref: "main",
        localSnapshot: ".tutor/pack"
      }
    }));

    await expect(readPackLock(root)).resolves.toEqual({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/marketplace.git",
        packRepo: "https://github.com/me/jpa-tutor-pack.git",
        ref: "main",
        localSnapshot: ".tutor/pack"
      }
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

  it("refuses to write progress through a symlinked .tutor directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-progress-symlink-"));
    const outside = await mkdtemp(join(tmpdir(), "study-tutor-progress-outside-"));
    const outsideProgress = join(outside, "progress.json");
    await writeFile(outsideProgress, "outside");
    await symlink(outside, join(root, ".tutor"));

    await expect(writeProgress(root, {
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      currentStep: "step-03-select-sql-generation",
      completedSteps: ["step-01-entity-annotations", "step-02-entity-metadata"]
    })).rejects.toThrow("Refusing to write outside project root");

    await expect(readFile(outsideProgress, "utf8")).resolves.toBe("outside");
  });

  it("refuses to write pack.lock through a symlinked .tutor directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-lock-symlink-"));
    const outside = await mkdtemp(join(tmpdir(), "study-tutor-lock-outside-"));
    const outsideLock = join(outside, "pack.lock");
    await writeFile(outsideLock, "outside");
    await symlink(outside, join(root, ".tutor"));

    await expect(writePackLock(root, {
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    })).rejects.toThrow("Refusing to write outside project root");

    await expect(readFile(outsideLock, "utf8")).resolves.toBe("outside");
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
