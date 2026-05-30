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

beforeEach(() => {
  vi.mocked(loadTutorPack).mockResolvedValue({} as Awaited<ReturnType<typeof loadTutorPack>>);
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
    const pack = { metadata: { id: "jpa-tutor-pack" } } as Awaited<ReturnType<typeof resolveRegistryPack>>["pack"];
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
    const pack = { metadata: { id: "jpa-tutor-pack" } } as Awaited<ReturnType<typeof resolveRegistryPack>>["pack"];
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
    const pack = { metadata: { id: "jpa-tutor-pack" } } as Awaited<ReturnType<typeof loadTutorPack>>;
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
      pack: { metadata: { id: "jpa-tutor-pack" } } as Awaited<ReturnType<typeof resolveRegistryPack>>["pack"],
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
