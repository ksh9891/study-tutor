import { advanceToNextStep, loadTutorPack, readProgress, StudyTutorError } from "@study-tutor/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runNextCommand } from "../commands/next.js";

vi.mock("@study-tutor/core", () => {
  class MockStudyTutorError extends Error {
    constructor(message: string, readonly details: string[] = []) {
      super(message);
      this.name = "StudyTutorError";
    }
  }

  return {
    StudyTutorError: MockStudyTutorError,
    advanceToNextStep: vi.fn(),
    loadTutorPack: vi.fn(),
    readProgress: vi.fn()
  };
});

function captureStderr() {
  let output = "";
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    output += `${args.join(" ")}\n`;
  });
  return () => output;
}

beforeEach(() => {
  vi.mocked(readProgress).mockResolvedValue({
    pack: "jpa-tutor-pack",
    version: "0.1.0",
    course: "mini-hibernate",
    currentStep: "step-01-entity-annotations",
    completedSteps: []
  });
  vi.mocked(loadTutorPack).mockResolvedValue({} as Awaited<ReturnType<typeof loadTutorPack>>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runNextCommand", () => {
  it("prints StudyTutorError details when Gradle checks fail", async () => {
    const stderr = captureStderr();
    vi.mocked(advanceToNextStep).mockRejectedValue(new StudyTutorError("Gradle tests failed", [
      "gradle failure details"
    ]));

    await expect(runNextCommand("/project")).rejects.toThrow("Gradle tests failed");

    expect(stderr()).toContain("gradle failure details");
    expect(stderr()).not.toContain("Edge-case TCK failed.");
  });

  it("prints the TCK header and StudyTutorError details when TCK checks fail", async () => {
    const stderr = captureStderr();
    vi.mocked(advanceToNextStep).mockRejectedValue(new StudyTutorError("TCK checks failed", [
      "tck failure output",
      "edge-case detail"
    ]));

    await expect(runNextCommand("/project")).rejects.toThrow("study-tutor next failed");

    expect(stderr()).toContain("Edge-case TCK failed.");
    expect(stderr()).toContain("tck failure output");
    expect(stderr()).toContain("edge-case detail");
  });
});
