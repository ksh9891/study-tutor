import fg from "fast-glob";
import { StudyTutorError } from "../errors.js";
import { installStepArtifacts } from "../pack/installer.js";
import { readProgress, writeProgress } from "../progress/progress-store.js";
import { runGradleTest } from "../test/gradle-runner.js";
import { runCurrentStepTck } from "../test/tck-runner.js";
import type { LoadedStep, LoadedTutorPack, TckEdgeCase } from "../pack/schema.js";
import type { GradleRunResult } from "../test/gradle-runner.js";
import type { TckRunResult } from "../test/tck-runner.js";

export interface AdvanceInput {
  projectRoot: string;
  pack: LoadedTutorPack;
  runGradle?: (projectRoot: string) => Promise<GradleRunResult>;
  runTck?: (input: { projectRoot: string; stepId: string }) => Promise<TckRunResult>;
}

export interface AdvanceResult {
  completedStep: LoadedStep;
  nextStep: LoadedStep | null;
  tckFailures: TckEdgeCase[];
}

async function assertLearnerTestExists(projectRoot: string): Promise<void> {
  const files = await fg("src/test/java/learner/**/*Test.java", {
    cwd: projectRoot,
    onlyFiles: true
  });
  if (files.length === 0) {
    throw new StudyTutorError("Write at least one learner test before running next with your current CLI invocation.", [
      "Expected at least one file matching src/test/java/learner/**/*Test.java"
    ]);
  }
}

function nextStepAfter(pack: LoadedTutorPack, currentStepId: string): LoadedStep | null {
  const index = pack.steps.findIndex((step) => step.id === currentStepId);
  if (index < 0) {
    throw new StudyTutorError(`Unknown current step ${currentStepId}`);
  }
  return pack.steps[index + 1] ?? null;
}

function packStepOrThrow(pack: LoadedTutorPack, stepId: string): LoadedStep {
  const step = pack.stepById.get(stepId);
  if (!step) {
    throw new StudyTutorError(`Unknown current step ${stepId}`);
  }
  return step;
}

export async function advanceToNextStep(input: AdvanceInput): Promise<AdvanceResult> {
  const progress = await readProgress(input.projectRoot);
  const currentStep = packStepOrThrow(input.pack, progress.currentStep);
  await assertLearnerTestExists(input.projectRoot);

  const gradleResult = await (input.runGradle ?? runGradleTest)(input.projectRoot);
  if (!gradleResult.ok) {
    throw new StudyTutorError("Gradle tests failed", [gradleResult.output]);
  }

  const tckResult = await (input.runTck ?? runCurrentStepTck)({
    projectRoot: input.projectRoot,
    stepId: progress.currentStep
  });
  if (!tckResult.ok) {
    throw new StudyTutorError("TCK checks failed", [
      tckResult.output,
      ...tckResult.failedEdgeCases.map((edgeCase) => `${edgeCase.title}\n왜 중요한가: ${edgeCase.whyImportant}\n힌트: ${edgeCase.hint}`)
    ]);
  }

  const nextStep = nextStepAfter(input.pack, progress.currentStep);
  const completedSteps = progress.completedSteps.includes(progress.currentStep)
    ? progress.completedSteps
    : [...progress.completedSteps, progress.currentStep];

  if (nextStep) {
    await installStepArtifacts(input.pack, input.projectRoot, nextStep.id);
  }

  await writeProgress(input.projectRoot, {
    ...progress,
    currentStep: nextStep?.id ?? progress.currentStep,
    completedSteps
  });

  return { completedStep: currentStep, nextStep, tckFailures: [] };
}
