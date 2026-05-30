import { lstat, readFile, readdir, rm, rmdir } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { copyDirectoryWithoutOverwrite } from "../fs/copy.js";
import { TckSchema } from "../pack/schema.js";
import { runGradleTest } from "./gradle-runner.js";
import type { TckEdgeCase } from "../pack/schema.js";
import type { GradleRunResult } from "./gradle-runner.js";

export interface TckRunInput {
  projectRoot: string;
  stepId: string;
  runGradle?: (projectRoot: string, args: string[]) => Promise<GradleRunResult>;
}

export interface TckRunResult {
  ok: boolean;
  output: string;
  failedEdgeCases: TckEdgeCase[];
}

interface TckSourcePaths {
  directories: string[];
  files: string[];
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function stepPackage(stepId: string): string {
  const number = stepId.match(/step-(\d+)/)?.[1] ?? stepId;
  return `tutortck.step${number}`;
}

async function readTckMetadata(projectRoot: string, stepId: string): Promise<TckEdgeCase[]> {
  const file = join(projectRoot, ".tutor", "steps", stepId, "tck.yaml");
  const parsed = TckSchema.parse(YAML.parse(await readFile(file, "utf8")));
  return Object.entries(parsed.edgeCases).map(([id, value]) => ({ id, ...value }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function simpleClassName(testClass: string): string {
  return testClass.split(".").at(-1) ?? testClass;
}

function containsSimpleClassName(output: string, simpleName: string): boolean {
  const javaIdentifier = "A-Za-z0-9_$";
  return new RegExp(`(^|[^${javaIdentifier}])${escapeRegExp(simpleName)}($|[^${javaIdentifier}])`).test(output);
}

function testClassPathVariants(testClass: string): string[] {
  const slashPath = testClass.replaceAll(".", "/");
  const backslashPath = testClass.replaceAll(".", "\\");
  return [
    slashPath,
    `${slashPath}.java`,
    backslashPath,
    `${backslashPath}.java`
  ];
}

function failedCaseFromOutput(edgeCase: TckEdgeCase, output: string): boolean {
  return output.includes(edgeCase.testClass)
    || containsSimpleClassName(output, simpleClassName(edgeCase.testClass))
    || testClassPathVariants(edgeCase.testClass).some((variant) => output.includes(variant));
}

function failedCasesFromOutput(edgeCases: TckEdgeCase[], output: string): TckEdgeCase[] {
  return edgeCases.filter((edgeCase) => failedCaseFromOutput(edgeCase, output));
}

async function listTckSourcePaths(sourceRoot: string, relativeRoot = ""): Promise<TckSourcePaths> {
  const entries = (await readdir(join(sourceRoot, relativeRoot), { withFileTypes: true }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const directories: string[] = [];
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      directories.push(relativePath);
      const childPaths = await listTckSourcePaths(sourceRoot, relativePath);
      directories.push(...childPaths.directories);
      files.push(...childPaths.files);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return { directories, files };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT" || code === "ENOTDIR") {
      return false;
    }
    throw error;
  }
}

async function preExistingTargetDirectories(targetRoot: string, directories: string[]): Promise<Set<string>> {
  const existingDirectories = new Set<string>();
  for (const directory of directories) {
    if (await pathExists(join(targetRoot, directory))) {
      existingDirectories.add(directory);
    }
  }
  return existingDirectories;
}

async function removeEmptyDirectory(path: string): Promise<void> {
  try {
    await rmdir(path);
  } catch (error) {
    const code = errorCode(error);
    if (code !== "ENOENT" && code !== "ENOTEMPTY") {
      throw error;
    }
  }
}

async function cleanupCopiedTck(files: string[], directories: string[]): Promise<void> {
  for (const file of [...files].sort((a, b) => b.length - a.length)) {
    await rm(file, { force: true });
  }

  for (const directory of [...directories].sort((a, b) => b.length - a.length)) {
    await removeEmptyDirectory(directory);
  }
}

export async function runCurrentStepTck(input: TckRunInput): Promise<TckRunResult> {
  const packageName = stepPackage(input.stepId);
  const source = join(input.projectRoot, ".tutor", "steps", input.stepId, "tck-tests");
  const targetRoot = join(input.projectRoot, "src", "test", "java");
  const sourcePaths = await listTckSourcePaths(source);
  const existingTargetDirectories = await preExistingTargetDirectories(targetRoot, sourcePaths.directories);
  const edgeCases = await readTckMetadata(input.projectRoot, input.stepId);
  const gradle = input.runGradle ?? runGradleTest;
  let copiedFiles: string[] = [];
  let createdDirectories: string[] = [];

  try {
    await copyDirectoryWithoutOverwrite(source, targetRoot, { containmentRoot: input.projectRoot });
    copiedFiles = sourcePaths.files.map((file) => join(targetRoot, file));
    createdDirectories = sourcePaths.directories
      .filter((directory) => !existingTargetDirectories.has(directory))
      .map((directory) => join(targetRoot, directory));
    const result = await gradle(input.projectRoot, ["--tests", `${packageName}.*`]);
    return {
      ok: result.ok,
      output: result.output,
      failedEdgeCases: result.ok ? [] : failedCasesFromOutput(edgeCases, result.output)
    };
  } finally {
    await cleanupCopiedTck(copiedFiles, createdDirectories);
  }
}
