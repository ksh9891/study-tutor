import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeProgress } from "@study-tutor/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runTestCommand } from "../commands/test.js";

async function createStudyProject(exitCode: number, output: string) {
  const root = await mkdtemp(join(tmpdir(), "study-tutor-cli-test-"));
  await writeProgress(root, {
    pack: "jpa-tutor-pack",
    version: "0.1.0",
    course: "mini-hibernate",
    currentStep: "step-01-entity-annotations",
    completedSteps: []
  });

  const gradlew = join(root, "gradlew");
  await writeFile(gradlew, `#!/usr/bin/env bash\necho "${output}"\nexit ${exitCode}\n`);
  await chmod(gradlew, 0o755);
  return root;
}

function captureStdout() {
  let output = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    output += chunk.toString();
    return true;
  });
  return () => output;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runTestCommand", () => {
  it("requires a study-tutor project root", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-cli-missing-"));

    await expect(runTestCommand(root)).rejects.toMatchObject({
      message: "Could not read .tutor/progress.json. Run this command from a study-tutor project root."
    });
  });

  it("prints Gradle output when tests pass", async () => {
    const root = await createStudyProject(0, "BUILD SUCCESSFUL");
    const stdout = captureStdout();

    await runTestCommand(root);

    expect(stdout()).toContain("BUILD SUCCESSFUL");
  });

  it("prints Gradle output and throws when tests fail", async () => {
    const root = await createStudyProject(1, "BUILD FAILED");
    const stdout = captureStdout();

    await expect(runTestCommand(root)).rejects.toThrow("study-tutor test failed");
    expect(stdout()).toContain("BUILD FAILED");
  });
});
