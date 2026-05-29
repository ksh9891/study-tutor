export const STUDY_TUTOR_CORE_VERSION = "0.1.0";
export { StudyTutorError } from "./errors.js";
export { copyDirectoryWithoutOverwrite } from "./fs/copy.js";
export { loadTutorPack } from "./pack/loader.js";
export { readProgress, writePackLock, writeProgress } from "./progress/progress-store.js";
export type {
  Course,
  LoadedStep,
  LoadedTutorPack,
  PackMetadata,
  StepMetadata,
  TckEdgeCase
} from "./pack/schema.js";
export type { PackLock, Progress } from "./progress/progress-store.js";
