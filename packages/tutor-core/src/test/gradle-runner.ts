import { join } from "node:path";
import { execa } from "execa";

export interface GradleRunResult {
  ok: boolean;
  output: string;
}

export interface GradleRunOptions {
  platform?: NodeJS.Platform;
}

function gradleWrapperForPlatform(projectRoot: string, platform: NodeJS.Platform): string {
  return platform === "win32" ? join(projectRoot, "gradlew.bat") : "./gradlew";
}

export async function runGradleTest(
  projectRoot: string,
  args: string[] = [],
  options: GradleRunOptions = {}
): Promise<GradleRunResult> {
  try {
    const platform = options.platform ?? process.platform;
    const result = await execa(gradleWrapperForPlatform(projectRoot, platform), ["test", ...args], {
      cwd: projectRoot,
      all: true,
      shell: platform === "win32",
      reject: false
    });
    return {
      ok: result.exitCode === 0,
      output: result.all ?? ""
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, output: message };
  }
}
