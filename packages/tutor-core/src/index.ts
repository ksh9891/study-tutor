export const STUDY_TUTOR_CORE_VERSION = "0.1.0";
export { StudyTutorError } from "./errors.js";
export { loadTutorPack } from "./pack/loader.js";
export type {
  Course,
  LoadedStep,
  LoadedTutorPack,
  PackMetadata,
  StepMetadata,
  TckEdgeCase
} from "./pack/schema.js";
