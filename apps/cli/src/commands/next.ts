import {
  advanceToNextStep,
  loadTutorPack,
  readProgress,
  resolveInstalledPackRoot,
  StudyTutorError
} from "@study-tutor/core";
import { bundledPackRoot } from "../paths.js";

const TCK_FAILURE_MESSAGE = "TCK checks failed";

function printStudyTutorErrorDetails(error: StudyTutorError): void {
  if (error.message === TCK_FAILURE_MESSAGE) {
    console.error("Edge-case TCK failed.");
  }

  for (const detail of error.details) {
    console.error("");
    console.error(detail);
  }
}

export async function runNextCommand(projectRoot = process.cwd()): Promise<void> {
  const progress = await readProgress(projectRoot);
  const packRoot = await resolveInstalledPackRoot(projectRoot, { bundledPackRoot });
  const pack = await loadTutorPack(packRoot);

  try {
    const result = await advanceToNextStep({ projectRoot, pack });
    console.log(`Step completed: ${result.completedStep.title}`);
    if (result.nextStep) {
      console.log(`Next step created: ${result.nextStep.title}`);
      console.log(`Read: .tutor/steps/${result.nextStep.id}/requirements.md`);
    } else {
      console.log("모든 MVP step을 완료했습니다.");
    }
  } catch (error) {
    if (error instanceof StudyTutorError) {
      printStudyTutorErrorDetails(error);
      if (error.message === TCK_FAILURE_MESSAGE) {
        throw new Error("study-tutor next failed");
      }
    }
    throw error;
  }
}
