import { readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { StudyTutorError } from "../errors.js";
import {
  CurriculumSchema,
  LoadedStep,
  LoadedTutorPack,
  PackSchema,
  StepSchema,
  TckEdgeCase,
  TckSchema
} from "./schema.js";

async function readYamlFile(path: string): Promise<unknown> {
  const source = await readFile(path, "utf8");
  return YAML.parse(source);
}

function formatZodError(file: string, error: unknown): StudyTutorError {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ path: Array<string | number>; message: string }> }).issues;
    return new StudyTutorError(`Invalid ${file}`, issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }
  return new StudyTutorError(`Invalid ${file}`, [String(error)]);
}

async function parseYamlWithSchema<T>(file: string, schema: { parse: (value: unknown) => T }): Promise<T> {
  try {
    return schema.parse(await readYamlFile(file));
  } catch (error) {
    throw formatZodError(file, error);
  }
}

async function loadStep(packRoot: string, stepId: string): Promise<LoadedStep> {
  const stepRoot = join(packRoot, "steps", stepId);
  const step = await parseYamlWithSchema(join(stepRoot, "step.yaml"), StepSchema);
  const tckFile = await parseYamlWithSchema(join(stepRoot, "tck.yaml"), TckSchema);
  const edgeCases: TckEdgeCase[] = Object.entries(tckFile.edgeCases).map(([id, value]) => ({
    id,
    ...value
  }));

  return {
    id: step.id,
    order: step.order,
    title: step.title,
    root: stepRoot,
    tck: { edgeCases }
  };
}

export async function loadTutorPack(packRoot: string): Promise<LoadedTutorPack> {
  const metadata = await parseYamlWithSchema(join(packRoot, "pack.yaml"), PackSchema);
  const curriculum = await parseYamlWithSchema(join(packRoot, "curriculum.yaml"), CurriculumSchema);
  const activeCourses = curriculum.courses.filter((course) => course.status === "active");
  const comingSoonCourses = curriculum.courses.filter((course) => course.status === "coming-soon");
  const activeStepIds = activeCourses.flatMap((course) => course.steps ?? []);

  if (!activeStepIds.includes(metadata.initialStep)) {
    throw new StudyTutorError(`initialStep ${metadata.initialStep} is not listed in an active course`);
  }

  const uniqueStepIds = [...new Set(activeStepIds)];
  const steps = (await Promise.all(uniqueStepIds.map((stepId) => loadStep(packRoot, stepId))))
    .sort((a, b) => a.order - b.order);
  const stepById = new Map(steps.map((step) => [step.id, step]));

  return {
    root: packRoot,
    metadata,
    curriculum,
    activeCourses,
    comingSoonCourses,
    steps,
    stepById
  };
}
