# Registry List MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `study-tutor registry list --url <git-repo-url>` so users can discover packs from a Git repo marketplace manifest.

**Architecture:** Keep CLI orchestration in `apps/cli` and registry manifest loading in `packages/tutor-core`. The core loader clones a registry repo into a temporary directory, reads root `packs.yaml`, validates it with Zod, returns typed data, and always attempts cleanup.

**Tech Stack:** TypeScript, Node.js 20+, pnpm, Commander, Zod, YAML, execa, Vitest.

---

## Scope Check

The approved spec is one coherent feature: registry listing only. It does not require pack installation, registry persistence, default registry configuration, remote services, or version pinning.

## File Structure

- Create: `packages/tutor-core/src/registry/schema.ts`
  - Defines `RegistryPackSchema`, `RegistryManifestSchema`, `RegistryPack`, and `RegistryManifest`.
- Create: `packages/tutor-core/src/registry/loader.ts`
  - Clones a registry Git repo, reads `packs.yaml`, validates the manifest, returns typed data, and cleans temporary files.
- Modify: `packages/tutor-core/src/index.ts`
  - Exports registry loader functions and registry types for the CLI package.
- Create: `packages/tutor-core/src/__tests__/registry-schema.test.ts`
  - Covers manifest schema parsing and validation.
- Create: `packages/tutor-core/src/__tests__/registry-loader.test.ts`
  - Covers manifest loading, clone failures, validation failures, missing manifests, and cleanup.
- Create: `apps/cli/src/commands/registry.ts`
  - Formats registry list output and runs the core loader.
- Modify: `apps/cli/src/index.ts`
  - Registers `registry list --url <git-repo-url>`.
- Create: `apps/cli/src/__tests__/registry-command.test.ts`
  - Covers output formatting, empty registries, URL validation, and command-to-core wiring.
- Modify: `README.md`
  - Documents the new registry list command and `packs.yaml` marketplace contract.

## Task 1: Registry Manifest Schema

**Files:**
- Create: `packages/tutor-core/src/registry/schema.ts`
- Create: `packages/tutor-core/src/__tests__/registry-schema.test.ts`

- [ ] **Step 1: Write the failing schema tests**

Create `packages/tutor-core/src/__tests__/registry-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RegistryManifestSchema } from "../registry/schema.js";

describe("RegistryManifestSchema", () => {
  it("parses a marketplace manifest with one pack", () => {
    const manifest = RegistryManifestSchema.parse({
      packs: [
        {
          id: "jpa-tutor-pack",
          name: "JPA Tutor Pack",
          description: "Mini Hibernate를 구현하며 JPA를 배우는 pack",
          repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
          defaultRef: "main",
          tags: ["java", "jpa", "backend"]
        }
      ]
    });

    expect(manifest.packs).toEqual([
      {
        id: "jpa-tutor-pack",
        name: "JPA Tutor Pack",
        description: "Mini Hibernate를 구현하며 JPA를 배우는 pack",
        repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
        defaultRef: "main",
        tags: ["java", "jpa", "backend"]
      }
    ]);
  });

  it("allows an empty pack list", () => {
    const manifest = RegistryManifestSchema.parse({ packs: [] });

    expect(manifest.packs).toEqual([]);
  });

  it("rejects path-like pack ids", () => {
    expect(() => RegistryManifestSchema.parse({
      packs: [
        {
          id: "../escape",
          name: "Bad Pack",
          description: "Invalid pack id",
          repo: "https://github.com/example/bad-pack.git",
          defaultRef: "main",
          tags: []
        }
      ]
    })).toThrow();
  });

  it("rejects empty required fields", () => {
    expect(() => RegistryManifestSchema.parse({
      packs: [
        {
          id: "empty-pack",
          name: "",
          description: "",
          repo: "",
          defaultRef: "",
          tags: []
        }
      ]
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run the schema test and verify it fails**

Run:

```bash
pnpm --filter @study-tutor/core test -- registry-schema.test.ts
```

Expected: FAIL because `packages/tutor-core/src/registry/schema.ts` does not exist.

- [ ] **Step 3: Implement the registry schema**

Create `packages/tutor-core/src/registry/schema.ts`:

```ts
import { z } from "zod";
import { IdSchema } from "../pack/schema.js";

export const RegistryPackSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  repo: z.string().min(1),
  defaultRef: z.string().min(1),
  tags: z.array(IdSchema).default([])
});

export const RegistryManifestSchema = z.object({
  packs: z.array(RegistryPackSchema)
});

export type RegistryPack = z.infer<typeof RegistryPackSchema>;
export type RegistryManifest = z.infer<typeof RegistryManifestSchema>;
```

- [ ] **Step 4: Run the schema test and verify it passes**

Run:

```bash
pnpm --filter @study-tutor/core test -- registry-schema.test.ts
```

Expected: PASS for all `RegistryManifestSchema` tests.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add packages/tutor-core/src/registry/schema.ts packages/tutor-core/src/__tests__/registry-schema.test.ts
git commit -m "feat: add registry manifest schema"
```

## Task 2: Registry Loader

**Files:**
- Create: `packages/tutor-core/src/registry/loader.ts`
- Create: `packages/tutor-core/src/__tests__/registry-loader.test.ts`
- Modify: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write the failing loader tests**

Create `packages/tutor-core/src/__tests__/registry-loader.test.ts`:

```ts
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { StudyTutorError } from "../errors.js";
import { loadRegistryManifest } from "../registry/loader.js";
import type { CloneRegistry } from "../registry/loader.js";

async function createTempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "study-tutor-registry-test-root-"));
}

function cloneWithManifest(source: string): CloneRegistry {
  return async ({ destination }) => {
    await mkdir(destination, { recursive: true });
    await writeFile(join(destination, "packs.yaml"), source);
  };
}

describe("loadRegistryManifest", () => {
  it("loads packs.yaml from a cloned registry", async () => {
    const tempRoot = await createTempRoot();

    const manifest = await loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone: cloneWithManifest([
        "packs:",
        "  - id: jpa-tutor-pack",
        "    name: JPA Tutor Pack",
        "    description: Mini Hibernate를 구현하며 JPA를 배우는 pack",
        "    repo: https://github.com/ksh9891/jpa-tutor-pack.git",
        "    defaultRef: main",
        "    tags:",
        "      - java",
        "      - jpa",
        "      - backend"
      ].join("\n"))
    });

    expect(manifest.packs).toEqual([
      {
        id: "jpa-tutor-pack",
        name: "JPA Tutor Pack",
        description: "Mini Hibernate를 구현하며 JPA를 배우는 pack",
        repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
        defaultRef: "main",
        tags: ["java", "jpa", "backend"]
      }
    ]);
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("returns an empty manifest when packs.yaml has no packs", async () => {
    const tempRoot = await createTempRoot();

    const manifest = await loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone: cloneWithManifest("packs: []")
    });

    expect(manifest.packs).toEqual([]);
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("fails when packs.yaml is missing", async () => {
    const tempRoot = await createTempRoot();
    const clone: CloneRegistry = async ({ destination }) => {
      await mkdir(destination, { recursive: true });
    };

    await expect(loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone
    })).rejects.toMatchObject({
      message: "Registry manifest packs.yaml not found"
    });
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("fails when packs.yaml has invalid yaml", async () => {
    const tempRoot = await createTempRoot();

    await expect(loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone: cloneWithManifest("packs:\n  - id: [")
    })).rejects.toMatchObject({
      message: "Invalid registry manifest YAML"
    });
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("fails when packs.yaml does not match the schema", async () => {
    const tempRoot = await createTempRoot();

    await expect(loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone: cloneWithManifest([
        "packs:",
        "  - id: ../escape",
        "    name: Bad Pack",
        "    description: Invalid pack id",
        "    repo: https://github.com/example/bad-pack.git",
        "    defaultRef: main",
        "    tags: []"
      ].join("\n"))
    })).rejects.toMatchObject({
      message: "Invalid packs.yaml",
      details: expect.arrayContaining([expect.stringContaining("packs.0.id")])
    });
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("wraps clone failures and cleans the temporary directory", async () => {
    const tempRoot = await createTempRoot();
    const clone = vi.fn<CloneRegistry>(async () => {
      throw new Error("network denied");
    });

    await expect(loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone
    })).rejects.toMatchObject({
      message: "Failed to clone registry",
      details: ["network denied"]
    });
    expect(clone).toHaveBeenCalledOnce();
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("preserves StudyTutorError clone failures", async () => {
    const tempRoot = await createTempRoot();
    const clone: CloneRegistry = async () => {
      throw new StudyTutorError("Failed to clone registry", ["fatal: repository not found"]);
    };

    await expect(loadRegistryManifest({
      url: "https://github.com/ksh9891/missing-marketplace.git",
      tempRoot,
      clone
    })).rejects.toMatchObject({
      message: "Failed to clone registry",
      details: ["fatal: repository not found"]
    });
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run the loader test and verify it fails**

Run:

```bash
pnpm --filter @study-tutor/core test -- registry-loader.test.ts
```

Expected: FAIL because `packages/tutor-core/src/registry/loader.ts` does not exist.

- [ ] **Step 3: Implement the registry loader**

Create `packages/tutor-core/src/registry/loader.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import YAML from "yaml";
import { z } from "zod";
import { StudyTutorError } from "../errors.js";
import { RegistryManifestSchema } from "./schema.js";
import type { RegistryManifest } from "./schema.js";

export interface CloneRegistryInput {
  url: string;
  destination: string;
}

export type CloneRegistry = (input: CloneRegistryInput) => Promise<void>;

export interface LoadRegistryManifestInput {
  url: string;
  tempRoot?: string;
  clone?: CloneRegistry;
}

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function outputFromExecaError(error: unknown): string {
  if (error && typeof error === "object") {
    const candidate = error as { all?: unknown; stderr?: unknown; stdout?: unknown; message?: unknown };
    if (typeof candidate.all === "string" && candidate.all.trim().length > 0) {
      return candidate.all;
    }
    if (typeof candidate.stderr === "string" && candidate.stderr.trim().length > 0) {
      return candidate.stderr;
    }
    if (typeof candidate.stdout === "string" && candidate.stdout.trim().length > 0) {
      return candidate.stdout;
    }
    if (typeof candidate.message === "string") {
      return candidate.message;
    }
  }
  return String(error);
}

function formatZodError(file: string, error: unknown): StudyTutorError {
  if (error instanceof z.ZodError) {
    return new StudyTutorError(`Invalid ${file}`, error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    }));
  }
  return new StudyTutorError(`Invalid ${file}`, [messageFromUnknown(error)]);
}

async function readRegistryManifestFile(file: string): Promise<RegistryManifest> {
  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
    if (code === "ENOENT") {
      throw new StudyTutorError("Registry manifest packs.yaml not found", [file]);
    }
    throw new StudyTutorError("Failed to read registry manifest", [messageFromUnknown(error)]);
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(source);
  } catch (error) {
    throw new StudyTutorError("Invalid registry manifest YAML", [messageFromUnknown(error)]);
  }

  try {
    return RegistryManifestSchema.parse(parsed);
  } catch (error) {
    throw formatZodError("packs.yaml", error);
  }
}

async function runClone(clone: CloneRegistry, input: CloneRegistryInput): Promise<void> {
  try {
    await clone(input);
  } catch (error) {
    if (error instanceof StudyTutorError) {
      throw error;
    }
    throw new StudyTutorError("Failed to clone registry", [messageFromUnknown(error)]);
  }
}

export async function cloneRegistryWithGit(input: CloneRegistryInput): Promise<void> {
  try {
    await execa("git", ["clone", "--depth", "1", input.url, input.destination], {
      all: true
    });
  } catch (error) {
    throw new StudyTutorError("Failed to clone registry", [outputFromExecaError(error)]);
  }
}

export async function loadRegistryManifest(input: LoadRegistryManifestInput): Promise<RegistryManifest> {
  const registryRoot = await mkdtemp(join(input.tempRoot ?? tmpdir(), "study-tutor-registry-"));
  try {
    await runClone(input.clone ?? cloneRegistryWithGit, {
      url: input.url,
      destination: registryRoot
    });
    return await readRegistryManifestFile(join(registryRoot, "packs.yaml"));
  } finally {
    await rm(registryRoot, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Export registry APIs from core**

Modify `packages/tutor-core/src/index.ts` so the full file becomes:

```ts
export const STUDY_TUTOR_CORE_VERSION = "0.1.0";
export { StudyTutorError } from "./errors.js";
export { copyDirectoryWithoutOverwrite } from "./fs/copy.js";
export { installTutorProject } from "./pack/installer.js";
export { loadTutorPack } from "./pack/loader.js";
export { cloneRegistryWithGit, loadRegistryManifest } from "./registry/loader.js";
export { readProgress, writePackLock, writeProgress } from "./progress/progress-store.js";
export { advanceToNextStep } from "./steps/step-service.js";
export { runGradleTest } from "./test/gradle-runner.js";
export { runCurrentStepTck } from "./test/tck-runner.js";
export type { AdvanceInput, AdvanceResult } from "./steps/step-service.js";
export type { GradleRunOptions, GradleRunResult } from "./test/gradle-runner.js";
export type { TckRunInput, TckRunResult } from "./test/tck-runner.js";
export type { InstallTutorProjectInput } from "./pack/installer.js";
export type { CloneRegistry, CloneRegistryInput, LoadRegistryManifestInput } from "./registry/loader.js";
export type { RegistryManifest, RegistryPack } from "./registry/schema.js";
export type {
  Course,
  LoadedStep,
  LoadedTutorPack,
  PackMetadata,
  StepMetadata,
  TckEdgeCase
} from "./pack/schema.js";
export type { PackLock, Progress } from "./progress/progress-store.js";
```

- [ ] **Step 5: Run core registry tests and verify they pass**

Run:

```bash
pnpm --filter @study-tutor/core test -- registry-schema.test.ts registry-loader.test.ts
```

Expected: PASS for schema and loader tests.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add packages/tutor-core/src/registry/loader.ts packages/tutor-core/src/index.ts packages/tutor-core/src/__tests__/registry-loader.test.ts
git commit -m "feat: load registry manifests from git"
```

## Task 3: CLI Registry Command

**Files:**
- Create: `apps/cli/src/commands/registry.ts`
- Create: `apps/cli/src/__tests__/registry-command.test.ts`
- Modify: `apps/cli/src/index.ts`

- [ ] **Step 1: Write the failing CLI command tests**

Create `apps/cli/src/__tests__/registry-command.test.ts`:

```ts
import { loadRegistryManifest } from "@study-tutor/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatRegistryList, runRegistryListCommand } from "../commands/registry.js";

vi.mock("@study-tutor/core", () => ({
  loadRegistryManifest: vi.fn()
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatRegistryList", () => {
  it("formats registry packs for terminal output", () => {
    const output = formatRegistryList({
      packs: [
        {
          id: "jpa-tutor-pack",
          name: "JPA Tutor Pack",
          description: "Mini Hibernate를 구현하며 JPA를 배우는 pack",
          repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
          defaultRef: "main",
          tags: ["java", "jpa", "backend"]
        }
      ]
    });

    expect(output).toContain("Available packs");
    expect(output).toContain("jpa-tutor-pack");
    expect(output).toContain("JPA Tutor Pack");
    expect(output).toContain("Mini Hibernate를 구현하며 JPA를 배우는 pack");
    expect(output).toContain("repo: https://github.com/ksh9891/jpa-tutor-pack.git");
    expect(output).toContain("ref: main");
    expect(output).toContain("tags: java, jpa, backend");
  });

  it("formats an empty registry", () => {
    const output = formatRegistryList({ packs: [] });

    expect(output).toBe("No packs found in registry.");
  });
});

describe("runRegistryListCommand", () => {
  it("loads the registry from the provided url and prints the formatted output", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logs.push(String(message ?? ""));
    });
    vi.mocked(loadRegistryManifest).mockResolvedValue({
      packs: [
        {
          id: "jpa-tutor-pack",
          name: "JPA Tutor Pack",
          description: "Mini Hibernate를 구현하며 JPA를 배우는 pack",
          repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
          defaultRef: "main",
          tags: ["java", "jpa"]
        }
      ]
    });

    await runRegistryListCommand({
      url: " https://github.com/ksh9891/study-tutor-marketplace.git "
    });

    expect(loadRegistryManifest).toHaveBeenCalledWith({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git"
    });
    expect(logs.join("\n")).toContain("jpa-tutor-pack");
    expect(logs.join("\n")).toContain("tags: java, jpa");
  });

  it("fails when url is missing", async () => {
    await expect(runRegistryListCommand({})).rejects.toThrow("Missing required option: --url <git-repo-url>");
  });

  it("fails when url is blank", async () => {
    await expect(runRegistryListCommand({ url: "   " })).rejects.toThrow("Missing required option: --url <git-repo-url>");
  });
});
```

- [ ] **Step 2: Run the CLI command test and verify it fails**

Run:

```bash
pnpm --filter @study-tutor/cli test -- registry-command.test.ts
```

Expected: FAIL because `apps/cli/src/commands/registry.ts` does not exist.

- [ ] **Step 3: Implement the registry command**

Create `apps/cli/src/commands/registry.ts`:

```ts
import { loadRegistryManifest } from "@study-tutor/core";
import type { RegistryPack } from "@study-tutor/core";

export interface RegistryListOptions {
  url?: string;
}

export interface RegistryListView {
  packs: RegistryPack[];
}

function formatTags(tags: string[]): string {
  return tags.length > 0 ? tags.join(", ") : "-";
}

export function formatRegistryList(view: RegistryListView): string {
  if (view.packs.length === 0) {
    return "No packs found in registry.";
  }

  const lines = ["Available packs", ""];
  for (const pack of view.packs) {
    lines.push(
      pack.id,
      `  ${pack.name}`,
      `  ${pack.description}`,
      `  repo: ${pack.repo}`,
      `  ref: ${pack.defaultRef}`,
      `  tags: ${formatTags(pack.tags)}`,
      ""
    );
  }

  return lines.slice(0, -1).join("\n");
}

export async function runRegistryListCommand(options: RegistryListOptions): Promise<void> {
  const url = options.url?.trim();
  if (!url) {
    throw new Error("Missing required option: --url <git-repo-url>");
  }

  const manifest = await loadRegistryManifest({ url });
  console.log(formatRegistryList({ packs: manifest.packs }));
}
```

- [ ] **Step 4: Register the command in the CLI entrypoint**

Modify `apps/cli/src/index.ts` so the full file becomes:

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { STUDY_TUTOR_CORE_VERSION } from "@study-tutor/core";
import { runInstallCommand } from "./commands/install.js";
import { runNextCommand } from "./commands/next.js";
import { runRegistryListCommand } from "./commands/registry.js";
import { runStatusCommand } from "./commands/status.js";
import { runTestCommand } from "./commands/test.js";

const program = new Command();

program
  .name("study-tutor")
  .description("CLI learning runtime for tutor packs")
  .version(STUDY_TUTOR_CORE_VERSION);

program
  .command("install")
  .argument("<pack-id>")
  .description("Install a tutor pack into a new study project")
  .action(runInstallCommand);

const registryCommand = program
  .command("registry")
  .description("Discover tutor packs from registries");

registryCommand
  .command("list")
  .description("List tutor packs from a Git registry")
  .requiredOption("--url <git-repo-url>", "Git repo URL for the marketplace registry")
  .action((options: { url: string }) => runRegistryListCommand(options));

program
  .command("status")
  .description("Show current study progress and next actions")
  .action(() => runStatusCommand());

program
  .command("test")
  .description("Run learner tests and public sanity tests")
  .action(() => runTestCommand());

program
  .command("next")
  .description("Run completion checks and create the next step")
  .action(() => runNextCommand());

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Run the CLI command tests and verify they pass**

Run:

```bash
pnpm --filter @study-tutor/cli test -- registry-command.test.ts
```

Expected: PASS for all registry command tests.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add apps/cli/src/commands/registry.ts apps/cli/src/index.ts apps/cli/src/__tests__/registry-command.test.ts
git commit -m "feat: add registry list command"
```

## Task 4: README Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the MVP command list**

Modify the MVP scope list in `README.md` to include the registry command:

```md
- `study-tutor install <pack-id>` 패키지 바이너리
- `study-tutor registry list --url <git-repo-url>` marketplace 조회
- `study-tutor status` 패키지 바이너리
- `study-tutor test` 패키지 바이너리
- `study-tutor next` 패키지 바이너리
```

- [ ] **Step 2: Add the registry usage section**

Insert this section after the `CLI 실행` section and before `학습 흐름`:

````md
## Registry 조회

Study Tutor의 marketplace는 Git repo 하나로 시작합니다. Repo root에는 `packs.yaml`이 있어야 합니다.

```yaml
packs:
  - id: jpa-tutor-pack
    name: JPA Tutor Pack
    description: Mini Hibernate를 구현하며 JPA를 배우는 pack
    repo: https://github.com/ksh9891/jpa-tutor-pack.git
    defaultRef: main
    tags:
      - java
      - jpa
      - backend
```

등록된 pack 목록은 다음 명령으로 조회합니다.

```bash
node "$CLI" registry list --url https://github.com/ksh9891/study-tutor-marketplace.git
```

MVP에서는 registry 조회만 지원합니다. Registry에 등록된 pack을 바로 설치하는 흐름은 이후 단계에서 연결합니다.
````

- [ ] **Step 3: Verify the README mentions the new command and manifest**

Run:

```bash
rg -n "registry list|packs.yaml|study-tutor-marketplace" README.md
```

Expected: output includes the MVP list item, the registry usage command, and the marketplace repo example.

- [ ] **Step 4: Commit Task 4**

Run:

```bash
git add README.md
git commit -m "docs: document registry listing"
```

## Task 5: Full Verification

**Files:**
- Validate the whole workspace.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run the full build**

Run:

```bash
pnpm build
```

Expected: TypeScript build passes for `@study-tutor/core` and `@study-tutor/cli`.

- [ ] **Step 3: Check CLI help output**

Run:

```bash
pnpm cli -- --help
pnpm cli -- registry --help
pnpm cli -- registry list --help
```

Expected:

- Root help lists `registry`.
- Registry help lists `list`.
- Registry list help shows `--url <git-repo-url>`.

- [ ] **Step 4: Smoke test registry listing with a local Git repo**

Run:

```bash
tmp="$(mktemp -d)"
mkdir "$tmp/marketplace"
cat > "$tmp/marketplace/packs.yaml" <<'YAML'
packs:
  - id: jpa-tutor-pack
    name: JPA Tutor Pack
    description: Mini Hibernate를 구현하며 JPA를 배우는 pack
    repo: https://github.com/ksh9891/jpa-tutor-pack.git
    defaultRef: main
    tags:
      - java
      - jpa
      - backend
YAML
git -C "$tmp/marketplace" init
git -C "$tmp/marketplace" add packs.yaml
git -C "$tmp/marketplace" -c user.name="Study Tutor" -c user.email="study-tutor@example.com" commit -m "Add packs manifest"
node apps/cli/dist/index.js registry list --url "$tmp/marketplace"
rm -rf "$tmp"
```

Expected output contains:

```text
Available packs
jpa-tutor-pack
JPA Tutor Pack
repo: https://github.com/ksh9891/jpa-tutor-pack.git
tags: java, jpa, backend
```

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: only `tutor_cli_project_brief.md` remains untracked. The implementation commits should be present on the current branch.

- [ ] **Step 6: Push the branch when verification passes**

Run:

```bash
git push origin feature/tutor-cli-mvp
```

Expected: push succeeds and updates `origin/feature/tutor-cli-mvp`.

## Self-Review Checklist

- Spec coverage: Tasks 1 and 2 implement `packs.yaml` schema validation, Git clone, manifest loading, and cleanup. Task 3 implements `study-tutor registry list --url <git-repo-url>`. Task 4 documents the command and marketplace contract. Task 5 verifies tests, build, CLI help, and a local Git smoke run.
- Scope check: The plan does not add registry persistence, default registry configuration, install-from-registry, pack repo installation, remote services, version pinning, or hidden TCK behavior.
- Type consistency: `RegistryManifest`, `RegistryPack`, `CloneRegistry`, `LoadRegistryManifestInput`, `loadRegistryManifest`, and `runRegistryListCommand` are defined before downstream use and exported through `packages/tutor-core/src/index.ts`.
- Test isolation: Registry loader tests inject a clone function and use local temporary directories, so they do not require GitHub or network access.
