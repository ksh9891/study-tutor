import { input, select } from "@inquirer/prompts";
import {
  installTutorProject,
  loadTutorPack,
  resolveRegistryPack,
  resolveRegistryUrl,
  StudyTutorError
} from "@study-tutor/core";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInstallCommand } from "../commands/install.js";

type LoadedTutorPack = Awaited<ReturnType<typeof loadTutorPack>>;

vi.mock("@inquirer/prompts", () => ({
  input: vi.fn(),
  select: vi.fn()
}));

vi.mock("@study-tutor/core", () => ({
  installTutorProject: vi.fn(),
  loadTutorPack: vi.fn(),
  resolveRegistryPack: vi.fn(),
  resolveRegistryUrl: vi.fn(),
  StudyTutorError: class StudyTutorError extends Error {
    details: string[];

    constructor(message: string, details: string[] = []) {
      super(message);
      this.name = "StudyTutorError";
      this.details = details;
    }
  }
}));

function packWithCourses(
  courses = [{ id: "mini-hibernate", title: "Mini Hibernate 구현", status: "active" as const }]
): LoadedTutorPack {
  return {
    root: "/tmp/pack",
    metadata: {
      id: "jpa-tutor-pack",
      name: "JPA Tutor Pack",
      version: "0.1.0",
      language: "java",
      runtime: {
        java: "17",
        buildTool: "gradle"
      },
      initialStep: "step-01"
    },
    curriculum: {
      courses
    },
    activeCourses: courses,
    comingSoonCourses: [],
    steps: [],
    stepById: new Map()
  };
}

beforeEach(() => {
  vi.mocked(loadTutorPack).mockResolvedValue(packWithCourses());
  vi.mocked(resolveRegistryUrl).mockResolvedValue("https://github.com/me/study-tutor-marketplace.git");
  vi.mocked(select).mockResolvedValue("mini-hibernate");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runInstallCommand", () => {
  it("installs a pack from a saved registry", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "study-tutor-install-command-"));
    const cleanup = vi.fn();
    const registrySource = {
      type: "registry",
      registryUrl: "https://github.com/me/study-tutor-marketplace.git",
      packRepo: "https://github.com/me/jpa-tutor-pack.git",
      ref: "main",
      localSnapshot: ".tutor/pack"
    } as const;
    const pack = packWithCourses();
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.mocked(input).mockResolvedValue("registry-study");
    vi.mocked(resolveRegistryPack).mockResolvedValue({
      pack,
      packRoot: "/tmp/pack-root",
      source: registrySource,
      cleanup
    });

    await runInstallCommand("jpa-tutor-pack", { registry: "official" });

    expect(resolveRegistryUrl).toHaveBeenCalledWith({ name: "official" });
    expect(resolveRegistryPack).toHaveBeenCalledWith({
      registryUrl: "https://github.com/me/study-tutor-marketplace.git",
      packId: "jpa-tutor-pack"
    });
    expect(installTutorProject).toHaveBeenCalledWith({
      pack,
      projectRoot: join(cwd, "registry-study"),
      courseId: "mini-hibernate",
      source: registrySource,
      snapshotSourceRoot: "/tmp/pack-root"
    });
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("installs a pack from a registry URL", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "study-tutor-install-command-"));
    const cleanup = vi.fn();
    const registrySource = {
      type: "registry",
      registryUrl: "https://github.com/me/marketplace.git",
      packRepo: "https://github.com/me/jpa-tutor-pack.git",
      ref: "main",
      localSnapshot: ".tutor/pack"
    } as const;
    const pack = packWithCourses();
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.mocked(input).mockResolvedValue("registry-study");
    vi.mocked(resolveRegistryPack).mockResolvedValue({
      pack,
      packRoot: "/tmp/pack-root",
      source: registrySource,
      cleanup
    });

    await runInstallCommand("jpa-tutor-pack", { registryUrl: " https://github.com/me/marketplace.git " });

    expect(resolveRegistryUrl).not.toHaveBeenCalled();
    expect(resolveRegistryPack).toHaveBeenCalledWith({
      registryUrl: "https://github.com/me/marketplace.git",
      packId: "jpa-tutor-pack"
    });
  });

  it("uses bundled install by default when no registry options are provided", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "study-tutor-install-command-"));
    const pack = packWithCourses();
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.mocked(input).mockResolvedValue("bundled-study");
    vi.mocked(loadTutorPack).mockResolvedValue(pack);

    await runInstallCommand("jpa-tutor-pack", {});

    expect(loadTutorPack).toHaveBeenCalled();
    expect(resolveRegistryPack).not.toHaveBeenCalled();
    expect(installTutorProject).toHaveBeenCalledWith({
      pack,
      projectRoot: join(cwd, "bundled-study"),
      courseId: "mini-hibernate",
      source: {
        type: "bundled",
        path: "packs/jpa-tutor-pack"
      },
      snapshotSourceRoot: undefined
    });
  });

  it("fails when both registry options are provided", async () => {
    await expect(runInstallCommand("jpa-tutor-pack", {
      registry: "official",
      registryUrl: "https://github.com/me/marketplace.git"
    })).rejects.toThrow("Use either --registry or --registry-url, not both");

    expect(resolveRegistryUrl).not.toHaveBeenCalled();
    expect(resolveRegistryPack).not.toHaveBeenCalled();
    expect(installTutorProject).not.toHaveBeenCalled();
  });

  it("cleans up a resolved registry pack when install fails", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "study-tutor-install-command-"));
    const cleanup = vi.fn();
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.mocked(input).mockResolvedValue("registry-study");
    vi.mocked(resolveRegistryPack).mockResolvedValue({
      pack: packWithCourses(),
      packRoot: "/tmp/pack-root",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/study-tutor-marketplace.git",
        packRepo: "https://github.com/me/jpa-tutor-pack.git",
        ref: "main",
        localSnapshot: ".tutor/pack"
      },
      cleanup
    });
    vi.mocked(installTutorProject).mockRejectedValue(new Error("install failed"));

    await expect(runInstallCommand("jpa-tutor-pack", { registry: "official" })).rejects.toThrow("install failed");

    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("cleans up a resolved registry pack when the install directory prompt fails", async () => {
    const cleanup = vi.fn();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.mocked(input).mockRejectedValue(new Error("prompt cancelled"));
    vi.mocked(resolveRegistryPack).mockResolvedValue({
      pack: packWithCourses(),
      packRoot: "/tmp/pack-root",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/study-tutor-marketplace.git",
        packRepo: "https://github.com/me/jpa-tutor-pack.git",
        ref: "main",
        localSnapshot: ".tutor/pack"
      },
      cleanup
    });

    await expect(runInstallCommand("jpa-tutor-pack", { registry: "official" })).rejects.toThrow("prompt cancelled");

    expect(cleanup).toHaveBeenCalledOnce();
    expect(installTutorProject).not.toHaveBeenCalled();
  });

  it("does not mask install failure when registry cleanup also fails", async () => {
    const cleanup = vi.fn().mockRejectedValue(new Error("cleanup failed"));
    vi.spyOn(process, "cwd").mockReturnValue(await mkdtemp(join(tmpdir(), "study-tutor-install-command-")));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.mocked(input).mockResolvedValue("registry-study");
    vi.mocked(resolveRegistryPack).mockResolvedValue({
      pack: packWithCourses(),
      packRoot: "/tmp/pack-root",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/study-tutor-marketplace.git",
        packRepo: "https://github.com/me/jpa-tutor-pack.git",
        ref: "main",
        localSnapshot: ".tutor/pack"
      },
      cleanup
    });
    vi.mocked(installTutorProject).mockRejectedValue(new Error("install failed"));

    await expect(runInstallCommand("jpa-tutor-pack", { registry: "official" })).rejects.toThrow("install failed");

    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("uses registry pack active courses for course choices", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "study-tutor-install-command-"));
    const pack = packWithCourses([
      { id: "fast-track", title: "Fast Track", status: "active" },
      { id: "deep-dive", title: "Deep Dive", status: "active" }
    ]);
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.mocked(input).mockResolvedValue("registry-study");
    vi.mocked(select).mockResolvedValue("deep-dive");
    vi.mocked(resolveRegistryPack).mockResolvedValue({
      pack,
      packRoot: "/tmp/pack-root",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/study-tutor-marketplace.git",
        packRepo: "https://github.com/me/custom-pack.git",
        ref: "main",
        localSnapshot: ".tutor/pack"
      },
      cleanup: vi.fn()
    });

    await runInstallCommand("custom-pack", { registry: "official" });

    expect(select).toHaveBeenCalledWith({
      message: "어떤 방식으로 학습할까요?",
      choices: [
        { name: "Fast Track", value: "fast-track" },
        { name: "Deep Dive", value: "deep-dive" }
      ]
    });
    expect(installTutorProject).toHaveBeenCalledWith(expect.objectContaining({
      courseId: "deep-dive"
    }));
  });

  it("rejects explicitly blank registry names instead of falling back to bundled install", async () => {
    await expect(runInstallCommand("jpa-tutor-pack", { registry: "   " })).rejects.toThrow("Missing registry name");

    expect(loadTutorPack).not.toHaveBeenCalled();
    expect(resolveRegistryUrl).not.toHaveBeenCalled();
    expect(resolveRegistryPack).not.toHaveBeenCalled();
  });

  it("rejects explicitly blank registry URLs instead of falling back to bundled install", async () => {
    await expect(runInstallCommand("jpa-tutor-pack", { registryUrl: "   " })).rejects.toThrow("Missing registry URL");

    expect(loadTutorPack).not.toHaveBeenCalled();
    expect(resolveRegistryUrl).not.toHaveBeenCalled();
    expect(resolveRegistryPack).not.toHaveBeenCalled();
  });

  it("preserves registry resolver error details", async () => {
    vi.mocked(resolveRegistryUrl).mockRejectedValue(new StudyTutorError("Unknown registry: missing", [
      "Run registry add first"
    ]));

    await expect(runInstallCommand("jpa-tutor-pack", { registry: "missing" })).rejects.toThrow(
      "Unknown registry: missing\n  - Run registry add first"
    );
  });

  it("uses the trimmed directory name for install path and success output", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "study-tutor-install-command-"));
    const logs: string[] = [];
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logs.push(String(message ?? ""));
    });
    vi.mocked(input).mockResolvedValue(" mini-jpa-study ");

    await runInstallCommand("jpa-tutor-pack");

    expect(installTutorProject).toHaveBeenCalledWith(expect.objectContaining({
      projectRoot: join(cwd, "mini-jpa-study")
    }));
    const output = logs.join("\n");
    expect(output).toContain(`경로: ${join(cwd, "mini-jpa-study")}`);
    expect(output).toContain("cd mini-jpa-study");
    expect(output).not.toContain("cd  mini-jpa-study ");
  });
});
