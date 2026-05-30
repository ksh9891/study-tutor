import { input, select } from "@inquirer/prompts";
import { installTutorProject, loadTutorPack } from "@study-tutor/core";
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
  loadTutorPack: vi.fn()
}));

beforeEach(() => {
  vi.mocked(loadTutorPack).mockResolvedValue({} as Awaited<ReturnType<typeof loadTutorPack>>);
  vi.mocked(select).mockResolvedValue("mini-hibernate");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runInstallCommand", () => {
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
