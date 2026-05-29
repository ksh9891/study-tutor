export class StudyTutorError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message);
    this.name = "StudyTutorError";
  }
}
