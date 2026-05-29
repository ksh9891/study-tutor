import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runGradleTest } from "../test/gradle-runner.js";

async function createFakeGradleWrapper(wrapperName: string, exitCode: number, output: string) {
  const root = await mkdtemp(join(tmpdir(), "study-tutor-gradle-"));
  const wrapper = join(root, wrapperName);
  await writeFile(wrapper, [
    "#!/usr/bin/env bash",
    'printf "%s\\n" "$@" > "$PWD/gradle-argv.txt"',
    `echo "${output}"`,
    `exit ${exitCode}`,
    ""
  ].join("\n"));
  await chmod(wrapper, 0o755);
  return root;
}

async function readGradleArgs(root: string): Promise<string[]> {
  const args = await readFile(join(root, "gradle-argv.txt"), "utf8");
  return args.trim().split("\n").filter(Boolean);
}

describe("runGradleTest", () => {
  it("returns success when gradlew test passes", async () => {
    const root = await createFakeGradleWrapper("gradlew", 0, "BUILD SUCCESSFUL");

    const result = await runGradleTest(root);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("BUILD SUCCESSFUL");
  });

  it("returns failure output when gradlew test fails", async () => {
    const root = await createFakeGradleWrapper("gradlew", 1, "BUILD FAILED");

    const result = await runGradleTest(root);

    expect(result.ok).toBe(false);
    expect(result.output).toContain("BUILD FAILED");
  });

  it("passes the test task and extra args to gradlew", async () => {
    const root = await createFakeGradleWrapper("gradlew", 0, "BUILD SUCCESSFUL");

    const result = await runGradleTest(root, ["--tests", "publictests.*"]);

    expect(result.ok).toBe(true);
    await expect(readGradleArgs(root)).resolves.toEqual(["test", "--tests", "publictests.*"]);
  });

  it("uses gradlew.bat for Windows projects", async () => {
    const root = await createFakeGradleWrapper("gradlew.bat", 0, "WINDOWS BUILD SUCCESSFUL");

    const result = await runGradleTest(root, [], { platform: "win32" });

    expect(result.ok).toBe(true);
    expect(result.output).toContain("WINDOWS BUILD SUCCESSFUL");
    await expect(readGradleArgs(root)).resolves.toEqual(["test"]);
  });
});
