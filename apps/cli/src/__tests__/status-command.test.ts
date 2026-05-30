import { loadTutorPack, readProgress, resolveInstalledPackRoot } from "@study-tutor/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runStatusCommand } from "../commands/status.js";

vi.mock("@study-tutor/core", () => ({
  loadTutorPack: vi.fn(),
  readProgress: vi.fn(),
  resolveInstalledPackRoot: vi.fn()
}));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.mocked(readProgress).mockResolvedValue({
    pack: "jpa-tutor-pack",
    version: "0.1.0",
    course: "mini-hibernate",
    currentStep: "step-01-entity-annotations",
    completedSteps: []
  });
  vi.mocked(resolveInstalledPackRoot).mockResolvedValue("/project/.tutor/pack");
  vi.mocked(loadTutorPack).mockResolvedValue({
    activeCourses: [
      {
        id: "mini-hibernate",
        title: "Mini Hibernate",
        steps: ["step-01-entity-annotations"]
      }
    ],
    steps: [
      {
        id: "step-01-entity-annotations",
        title: "Entity annotations"
      }
    ],
    stepById: new Map([
      [
        "step-01-entity-annotations",
        {
          id: "step-01-entity-annotations",
          title: "Entity annotations"
        }
      ]
    ])
  } as Awaited<ReturnType<typeof loadTutorPack>>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runStatusCommand", () => {
  it("loads the tutor pack from the installed pack resolver", async () => {
    await runStatusCommand("/project");

    expect(resolveInstalledPackRoot).toHaveBeenCalledWith(
      "/project",
      expect.objectContaining({ bundledPackRoot: expect.any(Function) })
    );
    expect(loadTutorPack).toHaveBeenCalledWith("/project/.tutor/pack");
  });
});
