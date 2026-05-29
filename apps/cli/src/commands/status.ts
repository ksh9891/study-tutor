import { loadTutorPack, readProgress } from "@study-tutor/core";
import { bundledPackRoot } from "../paths.js";

export interface StatusView {
  pack: string;
  version: string;
  courseTitle: string;
  currentStepTitle: string;
  currentStepId: string;
  completedCount: number;
  totalCount: number;
}

function stepNumber(stepId: string): string {
  return stepId.match(/step-(\d+)/)?.[1] ?? "?";
}

export function formatStatus(view: StatusView): string {
  return [
    `Pack: ${view.pack}@${view.version}`,
    `Course: ${view.courseTitle}`,
    `Current Step: ${stepNumber(view.currentStepId)} - ${view.currentStepTitle}`,
    `Completed Steps: ${view.completedCount}/${view.totalCount}`,
    "",
    "Next action:",
    `- .tutor/steps/${view.currentStepId}/requirements.md를 읽으세요.`,
    "- src/test/java/learner 아래에 직접 테스트를 작성하세요.",
    "- 구현 후 현재 사용 중인 CLI 실행 방식으로 test를 실행하세요.",
    "- 준비되면 현재 사용 중인 CLI 실행 방식으로 next를 실행하세요."
  ].join("\n");
}

export async function runStatusCommand(projectRoot = process.cwd()): Promise<void> {
  const progress = await readProgress(projectRoot);
  const pack = await loadTutorPack(bundledPackRoot(progress.pack));
  const course = pack.activeCourses.find((candidate) => candidate.id === progress.course);
  const step = pack.stepById.get(progress.currentStep);

  if (!course || !step) {
    throw new Error("progress.json references a course or step that does not exist in the bundled pack");
  }

  console.log(formatStatus({
    pack: progress.pack,
    version: progress.version,
    courseTitle: course.title,
    currentStepTitle: step.title,
    currentStepId: step.id,
    completedCount: progress.completedSteps.length,
    totalCount: course.steps?.length ?? pack.steps.length
  }));
}
