import { access, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { StudyTutorError } from "../errors.js";
import { copyDirectoryWithoutOverwrite } from "../fs/copy.js";
import { writePackLock, writeProgress } from "../progress/progress-store.js";
import type { LoadedTutorPack } from "./schema.js";

export interface InstallTutorProjectInput {
  pack: LoadedTutorPack;
  projectRoot: string;
  courseId: string;
  source: string;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function publicTestsTargetForStep(projectRoot: string, stepId: string): string {
  const stepNumber = stepId.match(/step-(\d+)/)?.[1] ?? stepId;
  return join(projectRoot, "src", "test", "java", "publictests", `step${stepNumber}`);
}

function assertActiveCourse(pack: LoadedTutorPack, courseId: string): void {
  if (!pack.activeCourses.some((course) => course.id === courseId)) {
    throw new StudyTutorError(`Unknown active course ${courseId}`);
  }
}

async function removeCreatedTarget(path: string, existedBefore: boolean): Promise<void> {
  if (!existedBefore) {
    await rm(path, { recursive: true, force: true });
  }
}

async function installStepArtifacts(pack: LoadedTutorPack, projectRoot: string, stepId: string): Promise<void> {
  const step = pack.stepById.get(stepId);
  if (!step) {
    throw new StudyTutorError(`Unknown step ${stepId}`);
  }

  const stepTarget = join(projectRoot, ".tutor", "steps", stepId);
  const publicTestsTarget = publicTestsTargetForStep(projectRoot, stepId);
  const stepTargetExisted = await pathExists(stepTarget);
  const publicTestsTargetExisted = await pathExists(publicTestsTarget);

  await mkdir(stepTarget, { recursive: true });
  try {
    await copyDirectoryWithoutOverwrite(step.root, stepTarget);
    await copyDirectoryWithoutOverwrite(join(step.root, "public-tests"), publicTestsTarget);
  } catch (error) {
    await Promise.all([
      removeCreatedTarget(publicTestsTarget, publicTestsTargetExisted),
      removeCreatedTarget(stepTarget, stepTargetExisted)
    ]);
    throw error;
  }
}

export async function installTutorProject(input: InstallTutorProjectInput): Promise<void> {
  if (await pathExists(input.projectRoot)) {
    throw new StudyTutorError("Install target already exists", [input.projectRoot]);
  }
  assertActiveCourse(input.pack, input.courseId);

  await mkdir(input.projectRoot, { recursive: true });
  try {
    await copyDirectoryWithoutOverwrite(join(input.pack.root, "templates", "gradle-project"), input.projectRoot);
    await installStepArtifacts(input.pack, input.projectRoot, input.pack.metadata.initialStep);
    await writeProgress(input.projectRoot, {
      pack: input.pack.metadata.id,
      version: input.pack.metadata.version,
      course: input.courseId,
      currentStep: input.pack.metadata.initialStep,
      completedSteps: []
    });
    await writePackLock(input.projectRoot, {
      pack: input.pack.metadata.id,
      version: input.pack.metadata.version,
      course: input.courseId,
      source: input.source
    });
  } catch (error) {
    await rm(input.projectRoot, { recursive: true, force: true });
    throw error;
  }
}

export { installStepArtifacts };
