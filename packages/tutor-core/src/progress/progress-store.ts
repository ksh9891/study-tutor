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

export const BundledPackSourceSchema = z.object({
  type: z.literal("bundled"),
  path: z.string().min(1)
});

export const RegistryPackSourceSchema = z.object({
  type: z.literal("registry"),
  registryUrl: z.string().min(1),
  packRepo: z.string().min(1),
  ref: z.string().min(1),
  localSnapshot: z.string().min(1)
});

export const PackSourceSchema = z.union([
  z.string().min(1),
  BundledPackSourceSchema,
  RegistryPackSourceSchema
]);

export const PackLockSchema = z.object({
  pack: z.string().min(1),
  version: z.string().min(1),
  course: z.string().min(1),
  source: PackSourceSchema
});

export type Progress = z.infer<typeof ProgressSchema>;
export type BundledPackSource = z.infer<typeof BundledPackSourceSchema>;
export type RegistryPackSource = z.infer<typeof RegistryPackSourceSchema>;
export type PackSource = z.infer<typeof PackSourceSchema>;
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

export async function readPackLock(projectRoot: string): Promise<PackLock> {
  const path = join(tutorDir(projectRoot), "pack.lock");
  try {
    return PackLockSchema.parse(YAML.parse(await readFile(path, "utf8")));
  } catch (error) {
    throw new StudyTutorError("Could not read .tutor/pack.lock. Run this command from a study-tutor project root.", [String(error)]);
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
