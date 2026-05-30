import { execFile, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { installTutorProject, loadTutorPack } from "@study-tutor/core";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

type CliEnvironment = NodeJS.ProcessEnv;

function repositoryRootFromTestFile() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

async function runCli(
  repositoryRoot: string,
  projectRoot: string,
  args: string[],
  options: { env?: CliEnvironment; timeout?: number } = {}
) {
  return execFileAsync(process.execPath, [join(repositoryRoot, "apps", "cli", "dist", "index.js"), ...args], {
    cwd: projectRoot,
    env: options.env,
    maxBuffer: 1024 * 1024 * 10,
    timeout: options.timeout ?? 120_000
  });
}

async function runCliSelectingPromptDefaults(
  repositoryRoot: string,
  projectRoot: string,
  args: string[],
  options: { env?: CliEnvironment; timeout?: number } = {}
) {
  const cli = join(repositoryRoot, "apps", "cli", "dist", "index.js");
  const child = spawn(process.execPath, [cli, ...args], {
    cwd: projectRoot,
    env: options.env,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const timeout = setTimeout(() => child.kill(), options.timeout ?? 120_000);
  let stdout = "";
  let stderr = "";
  let selectedDirectory = false;
  let selectedCourse = false;

  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (!selectedDirectory && stdout.includes("어디에 설치할까요?")) {
        selectedDirectory = true;
        setTimeout(() => child.stdin.write("\n"), 50);
      }
      if (!selectedCourse && stdout.includes("어떤 방식으로 학습할까요?")) {
        selectedCourse = true;
        setTimeout(() => child.stdin.write("\n"), 50);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`CLI exited with ${code ?? signal}\n${stdout}\n${stderr}`));
    });
  });
}

async function commitAll(repositoryRoot: string, message: string) {
  await execa("git", ["init"], { cwd: repositoryRoot, all: true });
  await execa("git", ["checkout", "-B", "main"], { cwd: repositoryRoot, all: true });
  await execa("git", ["config", "user.email", "study-tutor@example.test"], { cwd: repositoryRoot, all: true });
  await execa("git", ["config", "user.name", "Study Tutor Smoke"], { cwd: repositoryRoot, all: true });
  await execa("git", ["add", "."], { cwd: repositoryRoot, all: true });
  await execa("git", ["commit", "-m", message], { cwd: repositoryRoot, all: true });
}

describe("CLI binary smoke flow", () => {
  it("runs status, test, and next from the generated project cwd", async () => {
    const repositoryRoot = repositoryRootFromTestFile();
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-cli-e2e-"));
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

    const statusResult = await runCli(repositoryRoot, projectRoot, ["status"]);
    expect(statusResult.stdout).toContain("Current Step: 01 - Entity Annotation 만들기");
    expect(statusResult.stdout).toContain("Next action:");

    const testResult = await runCli(repositoryRoot, projectRoot, ["test"]);
    expect(testResult.stdout).toContain("BUILD SUCCESSFUL");

    const nextResult = await runCli(repositoryRoot, projectRoot, ["next"]);
    expect(nextResult.stdout).toContain("Step completed: Entity Annotation 만들기");
    expect(nextResult.stdout).toContain("Next step created: EntityMetadata 추출하기");

    const progress = JSON.parse(await readFile(join(projectRoot, ".tutor", "progress.json"), "utf8"));
    expect(progress.currentStep).toBe("step-02-entity-metadata");
    expect(progress.completedSteps).toEqual(["step-01-entity-annotations"]);
  }, 180_000);

  it("installs a pack from a saved registry and runs the generated project flow", async () => {
    const repositoryRoot = repositoryRootFromTestFile();
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-cli-registry-e2e-"));
    const tempHome = join(workspace, "home");
    const packRepo = join(workspace, "jpa-tutor-pack-repo");
    const marketplaceRepo = join(workspace, "marketplace-repo");
    const projectWorkspace = join(workspace, "projects");
    const projectRoot = join(projectWorkspace, "mini-jpa-study");
    const env = { ...process.env, HOME: tempHome };

    await mkdir(tempHome, { recursive: true });
    await mkdir(projectWorkspace, { recursive: true });
    await cp(join(repositoryRoot, "packs", "jpa-tutor-pack"), packRepo, { recursive: true });
    await commitAll(packRepo, "Initial pack");

    await mkdir(marketplaceRepo, { recursive: true });
    await writeFile(join(marketplaceRepo, "packs.yaml"), [
      "packs:",
      "  - id: jpa-tutor-pack",
      "    name: JPA Tutor Pack",
      "    description: Mini Hibernate를 구현하며 JPA를 배우는 pack",
      `    repo: ${JSON.stringify(packRepo)}`,
      "    defaultRef: main",
      "    tags:",
      "      - java",
      "      - jpa",
      "      - backend",
      ""
    ].join("\n"));
    await commitAll(marketplaceRepo, "Initial registry");

    await runCli(repositoryRoot, projectWorkspace, ["registry", "add", "local", marketplaceRepo], { env });

    const listResult = await runCli(repositoryRoot, projectWorkspace, ["registry", "list", "--registry", "local"], { env });
    expect(listResult.stdout).toContain("jpa-tutor-pack");

    await runCliSelectingPromptDefaults(repositoryRoot, projectWorkspace, ["install", "jpa-tutor-pack", "--registry", "local"], {
      env,
      timeout: 120_000
    });
    expect(await readFile(join(projectRoot, ".tutor", "pack", "pack.yaml"), "utf8")).toContain("id: jpa-tutor-pack");

    await cp(join(repositoryRoot, "examples", "fixtures", "step01-solution", "src"), join(projectRoot, "src"), {
      recursive: true
    });

    const statusResult = await runCli(repositoryRoot, projectRoot, ["status"], { env });
    expect(statusResult.stdout).toContain("Current Step: 01 - Entity Annotation 만들기");
    expect(statusResult.stdout).toContain("Next action:");

    const testResult = await runCli(repositoryRoot, projectRoot, ["test"], { env, timeout: 180_000 });
    expect(testResult.stdout).toContain("BUILD SUCCESSFUL");

    const nextResult = await runCli(repositoryRoot, projectRoot, ["next"], { env, timeout: 180_000 });
    expect(nextResult.stdout).toContain("Step completed: Entity Annotation 만들기");
    expect(nextResult.stdout).toContain("Next step created: EntityMetadata 추출하기");
  }, 240_000);
});
