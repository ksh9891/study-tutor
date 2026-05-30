import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { StudyTutorError } from "../errors.js";
import { assertContainedPath } from "../fs/containment.js";

export const ProgressSchema = z.object({
  pack: z.string().min(1),
  version: z.string().min(1),
  course: z.string().min(1),
  currentStep: z.string().min(1),
  completedSteps: z.array(z.string().min(1))
});

export const PackLockSchema = z.object({
  pack: z.string().min(1),
  version: z.string().min(1),
  course: z.string().min(1),
  source: z.string().min(1)
});

export type Progress = z.infer<typeof ProgressSchema>;
export type PackLock = z.infer<typeof PackLockSchema>;

function tutorDir(projectRoot: string): string {
  return join(projectRoot, ".tutor");
}

export async function readProgress(projectRoot: string): Promise<Progress> {
  const path = join(tutorDir(projectRoot), "progress.json");
  try {
    return ProgressSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    throw new StudyTutorError("Could not read .tutor/progress.json. Run this command from a study-tutor project root.", [String(error)]);
  }
}

export async function writeProgress(projectRoot: string, progress: Progress): Promise<void> {
  const directory = tutorDir(projectRoot);
  const target = join(directory, "progress.json");
  await assertContainedPath(projectRoot, directory);
  await assertContainedPath(projectRoot, target);
  await mkdir(directory, { recursive: true });
  const parsed = ProgressSchema.parse(progress);
  await assertContainedPath(projectRoot, target);
  await writeFile(target, `${JSON.stringify(parsed, null, 2)}\n`);
}

export async function writePackLock(projectRoot: string, packLock: PackLock): Promise<void> {
  const directory = tutorDir(projectRoot);
  const target = join(directory, "pack.lock");
  await assertContainedPath(projectRoot, directory);
  await assertContainedPath(projectRoot, target);
  await mkdir(directory, { recursive: true });
  const parsed = PackLockSchema.parse(packLock);
  await assertContainedPath(projectRoot, target);
  await writeFile(target, YAML.stringify(parsed));
}
