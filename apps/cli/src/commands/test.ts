import { readProgress, runGradleTest } from "@study-tutor/core";

export async function runTestCommand(projectRoot = process.cwd()): Promise<void> {
  await readProgress(projectRoot);
  const result = await runGradleTest(projectRoot);
  process.stdout.write(result.output);
  if (!result.ok) {
    throw new Error("study-tutor test failed");
  }
}
