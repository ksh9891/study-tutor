import { access, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCurrentStepTck } from "../test/tck-runner.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("runCurrentStepTck", () => {
  it("copies TCK files, runs filtered Gradle tests, and cleans copied files", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-tck-"));
    await mkdir(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01"), { recursive: true });
    await mkdir(join(projectRoot, "src", "test", "java"), { recursive: true });
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01", "SampleTckTest.java"), "package tutortck.step01; class SampleTckTest {}");
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck.yaml"), [
      "edgeCases:",
      "  sample:",
      "    testClass: tutortck.step01.SampleTckTest",
      "    title: Sample edge",
      "    whyImportant: Sample reason",
      "    hint: Sample hint"
    ].join("\n"));

    const seenArgs: string[][] = [];
    const copiedTckFile = join(projectRoot, "src", "test", "java", "tutortck", "step01", "SampleTckTest.java");
    const result = await runCurrentStepTck({
      projectRoot,
      stepId: "step-01",
      runGradle: async (_root, args) => {
        seenArgs.push(args);
        await expect(exists(copiedTckFile)).resolves.toBe(true);
        return { ok: true, output: "BUILD SUCCESSFUL" };
      }
    });

    expect(result.ok).toBe(true);
    expect(seenArgs[0]).toEqual(["--tests", "tutortck.step01.*"]);
    await expect(exists(copiedTckFile)).resolves.toBe(false);
  });

  it("maps failed TCK output to tck.yaml edge case messages", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-tck-fail-"));
    await mkdir(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01"), { recursive: true });
    await mkdir(join(projectRoot, "src", "test", "java"), { recursive: true });
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01", "SampleTckTest.java"), "package tutortck.step01; class SampleTckTest {}");
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck.yaml"), [
      "edgeCases:",
      "  sample:",
      "    testClass: tutortck.step01.SampleTckTest",
      "    title: Sample edge",
      "    whyImportant: Sample reason",
      "    hint: Sample hint"
    ].join("\n"));

    const result = await runCurrentStepTck({
      projectRoot,
      stepId: "step-01",
      runGradle: async () => ({ ok: false, output: "tutortck.step01.SampleTckTest > sample failed" })
    });

    expect(result.ok).toBe(false);
    expect(result.failedEdgeCases).toEqual([{
      id: "sample",
      testClass: "tutortck.step01.SampleTckTest",
      title: "Sample edge",
      whyImportant: "Sample reason",
      hint: "Sample hint"
    }]);
  });

  it("maps simple class Gradle failure output to tck.yaml edge case messages", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-tck-simple-fail-"));
    await mkdir(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01"), { recursive: true });
    await mkdir(join(projectRoot, "src", "test", "java"), { recursive: true });
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01", "SampleTckTest.java"), "package tutortck.step01; class SampleTckTest {}");
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck.yaml"), [
      "edgeCases:",
      "  sample:",
      "    testClass: tutortck.step01.SampleTckTest",
      "    title: Sample edge",
      "    whyImportant: Sample reason",
      "    hint: Sample hint"
    ].join("\n"));

    const result = await runCurrentStepTck({
      projectRoot,
      stepId: "step-01",
      runGradle: async () => ({ ok: false, output: "SampleTckTest > sample failed" })
    });

    expect(result.ok).toBe(false);
    expect(result.failedEdgeCases).toEqual([{
      id: "sample",
      testClass: "tutortck.step01.SampleTckTest",
      title: "Sample edge",
      whyImportant: "Sample reason",
      hint: "Sample hint"
    }]);
  });

  it("maps source path Gradle failure output to tck.yaml edge case messages", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-tck-path-fail-"));
    await mkdir(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01"), { recursive: true });
    await mkdir(join(projectRoot, "src", "test", "java"), { recursive: true });
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01", "SampleTckTest.java"), "package tutortck.step01; class SampleTckTest {}");
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck.yaml"), [
      "edgeCases:",
      "  sample:",
      "    testClass: tutortck.step01.SampleTckTest",
      "    title: Sample edge",
      "    whyImportant: Sample reason",
      "    hint: Sample hint"
    ].join("\n"));

    const result = await runCurrentStepTck({
      projectRoot,
      stepId: "step-01",
      runGradle: async () => ({ ok: false, output: "compile failed: tutortck/step01/SampleTckTest.java:12" })
    });

    expect(result.ok).toBe(false);
    expect(result.failedEdgeCases).toEqual([{
      id: "sample",
      testClass: "tutortck.step01.SampleTckTest",
      title: "Sample edge",
      whyImportant: "Sample reason",
      hint: "Sample hint"
    }]);
  });

  it("rejects conflicting pre-existing TCK target files without overwriting them", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-tck-conflict-"));
    await mkdir(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01"), { recursive: true });
    await mkdir(join(projectRoot, "src", "test", "java", "tutortck", "step01"), { recursive: true });
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01", "SampleTckTest.java"), "package tutortck.step01; class SampleTckTest {}");
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck.yaml"), [
      "edgeCases:",
      "  sample:",
      "    testClass: tutortck.step01.SampleTckTest",
      "    title: Sample edge",
      "    whyImportant: Sample reason",
      "    hint: Sample hint"
    ].join("\n"));

    const existingTarget = join(projectRoot, "src", "test", "java", "tutortck", "step01", "SampleTckTest.java");
    await writeFile(existingTarget, "existing project test");

    await expect(runCurrentStepTck({
      projectRoot,
      stepId: "step-01",
      runGradle: async () => ({ ok: true, output: "should not run" })
    })).rejects.toThrow("Refusing to overwrite existing files");
    await expect(readFile(existingTarget, "utf8")).resolves.toBe("existing project test");
  });

  it("preserves non-conflicting pre-existing TCK package files after cleanup", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-tck-preserve-"));
    await mkdir(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01"), { recursive: true });
    await mkdir(join(projectRoot, "src", "test", "java", "tutortck", "project"), { recursive: true });
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01", "SampleTckTest.java"), "package tutortck.step01; class SampleTckTest {}");
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck.yaml"), [
      "edgeCases:",
      "  sample:",
      "    testClass: tutortck.step01.SampleTckTest",
      "    title: Sample edge",
      "    whyImportant: Sample reason",
      "    hint: Sample hint"
    ].join("\n"));

    const existingTarget = join(projectRoot, "src", "test", "java", "tutortck", "project", "ExistingTest.java");
    await writeFile(existingTarget, "existing project test");

    const result = await runCurrentStepTck({
      projectRoot,
      stepId: "step-01",
      runGradle: async () => ({ ok: true, output: "BUILD SUCCESSFUL" })
    });

    expect(result.ok).toBe(true);
    await expect(readFile(existingTarget, "utf8")).resolves.toBe("existing project test");
    await expect(exists(join(projectRoot, "src", "test", "java", "tutortck", "step01", "SampleTckTest.java"))).resolves.toBe(false);
  });

  it("refuses to copy TCK tests through a symlinked target ancestor", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-tck-target-symlink-"));
    const outside = join(projectRoot, "..", "outside-tck-tests");
    await mkdir(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01"), { recursive: true });
    await mkdir(join(projectRoot, "src"), { recursive: true });
    await mkdir(outside, { recursive: true });
    await symlink(outside, join(projectRoot, "src", "test"), "dir");
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01", "SampleTckTest.java"), "package tutortck.step01; class SampleTckTest {}");
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck.yaml"), [
      "edgeCases:",
      "  sample:",
      "    testClass: tutortck.step01.SampleTckTest",
      "    title: Sample edge",
      "    whyImportant: Sample reason",
      "    hint: Sample hint"
    ].join("\n"));

    await expect(runCurrentStepTck({
      projectRoot,
      stepId: "step-01",
      runGradle: async () => {
        throw new Error("Gradle should not run when the TCK target escapes the project");
      }
    })).rejects.toThrow("Refusing to write outside project root");
    await expect(exists(join(outside, "java", "tutortck", "step01", "SampleTckTest.java"))).resolves.toBe(false);
  });
});
