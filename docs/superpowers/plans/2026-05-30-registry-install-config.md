# Registry Install And Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save registry URLs, list packs from saved registries, and install packs from registry Git repos while preserving the existing bundled install path.

**Architecture:** Keep CLI commands thin and put config, registry resolution, Git clone/checkout, pack snapshotting, and pack-root resolution in `packages/tutor-core`. Registry installs copy a pack snapshot into `.tutor/pack`, and `status`/`next` resolve packs from `pack.lock` so learning continues without network access.

**Tech Stack:** TypeScript, Node.js 20+, pnpm, Commander, Zod, YAML, execa, fs-extra, Vitest.

---

## Scope Check

The spec combines two tightly related capabilities: registry config storage and registry-based install. They share the same config model, manifest model, pack source model, and install flow, so one plan is appropriate. This plan does not add registry removal, default registry selection, version ranges, sha pinning, hidden TCK, remote servers, or UI.

## File Structure

- Modify: `packages/tutor-core/src/registry/schema.ts`
  - Add registry config schemas and pack source schemas.
- Create: `packages/tutor-core/src/registry/config-store.ts`
  - Read, write, add, and resolve named registries.
- Create: `packages/tutor-core/src/registry/pack-resolver.ts`
  - Resolve a registry pack from manifest, clone pack repo, checkout `defaultRef`, and return a loaded pack plus source metadata.
- Create: `packages/tutor-core/src/pack/source-resolver.ts`
  - Resolve installed project pack root from `.tutor/pack.lock`.
- Modify: `packages/tutor-core/src/progress/progress-store.ts`
  - Expand `PackLockSchema.source` from string to source object while accepting legacy string source.
- Modify: `packages/tutor-core/src/pack/installer.ts`
  - Accept source object, optionally snapshot pack repo into `.tutor/pack`.
- Modify: `packages/tutor-core/src/index.ts`
  - Export new store, resolver, and source types.
- Modify: `apps/cli/src/commands/registry.ts`
  - Add `registry add` support and `registry list --registry`.
- Modify: `apps/cli/src/commands/install.ts`
  - Add `--registry` and `--registry-url` install modes.
- Modify: `apps/cli/src/commands/status.ts`
  - Load pack via `pack.lock` source resolver.
- Modify: `apps/cli/src/commands/next.ts`
  - Load pack via `pack.lock` source resolver.
- Modify: `apps/cli/src/index.ts`
  - Register new registry and install options.
- Modify: `README.md`
  - Document registry add, saved registry list, and install from registry.
- Create/modify tests:
  - `packages/tutor-core/src/__tests__/registry-config-store.test.ts`
  - `packages/tutor-core/src/__tests__/registry-pack-resolver.test.ts`
  - `packages/tutor-core/src/__tests__/progress-store.test.ts`
  - `packages/tutor-core/src/__tests__/installer.test.ts`
  - `packages/tutor-core/src/__tests__/pack-source-resolver.test.ts`
  - `apps/cli/src/__tests__/registry-command.test.ts`
  - `apps/cli/src/__tests__/install-command.test.ts`
  - `apps/cli/src/__tests__/status-output.test.ts` or a new focused status command test
  - `apps/cli/src/__tests__/next-command.test.ts`
  - `apps/cli/src/__tests__/e2e-smoke.test.ts`

## Task 1: Registry Config Store

**Files:**
- Modify: `packages/tutor-core/src/registry/schema.ts`
- Create: `packages/tutor-core/src/registry/config-store.ts`
- Create: `packages/tutor-core/src/__tests__/registry-config-store.test.ts`
- Modify: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write failing config store tests**

Create `packages/tutor-core/src/__tests__/registry-config-store.test.ts`:

```ts
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addRegistry,
  readRegistryConfig,
  registryConfigPath,
  resolveRegistryUrl
} from "../registry/config-store.js";

async function createConfigRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "study-tutor-registry-config-"));
}

describe("registry config store", () => {
  it("returns an empty config when registries.json does not exist", async () => {
    const configRoot = await createConfigRoot();

    await expect(readRegistryConfig({ configRoot })).resolves.toEqual({ registries: {} });
  });

  it("adds a registry and can resolve it by name", async () => {
    const configRoot = await createConfigRoot();

    await addRegistry({
      configRoot,
      name: "official",
      url: "https://github.com/me/study-tutor-marketplace.git"
    });

    await expect(readRegistryConfig({ configRoot })).resolves.toEqual({
      registries: {
        official: {
          url: "https://github.com/me/study-tutor-marketplace.git"
        }
      }
    });
    await expect(resolveRegistryUrl({ configRoot, name: "official" })).resolves.toBe(
      "https://github.com/me/study-tutor-marketplace.git"
    );
  });

  it("rejects duplicate registry names", async () => {
    const configRoot = await createConfigRoot();
    await addRegistry({ configRoot, name: "official", url: "https://github.com/me/one.git" });

    await expect(addRegistry({
      configRoot,
      name: "official",
      url: "https://github.com/me/two.git"
    })).rejects.toThrow("Registry already exists: official");
  });

  it("rejects invalid registry names", async () => {
    const configRoot = await createConfigRoot();

    await expect(addRegistry({
      configRoot,
      name: "../escape",
      url: "https://github.com/me/registry.git"
    })).rejects.toMatchObject({
      message: "Invalid registry name"
    });
  });

  it("fails with details when registries.json is malformed", async () => {
    const configRoot = await createConfigRoot();
    await mkdir(join(configRoot, ".study-tutor"), { recursive: true });
    await writeFile(registryConfigPath(configRoot), "{");

    await expect(readRegistryConfig({ configRoot })).rejects.toMatchObject({
      message: "Invalid registry config"
    });
  });

  it("fails when resolving an unknown registry", async () => {
    const configRoot = await createConfigRoot();

    await expect(resolveRegistryUrl({ configRoot, name: "missing" })).rejects.toThrow(
      "Unknown registry: missing"
    );
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
pnpm --filter @study-tutor/core test -- registry-config-store.test.ts
```

Expected: FAIL because `registry/config-store.ts` does not exist.

- [ ] **Step 3: Add registry config schemas**

Update `packages/tutor-core/src/registry/schema.ts` to include:

```ts
export const RegistryConfigEntrySchema = z.object({
  url: z.string().min(1)
});

export const RegistryConfigSchema = z.object({
  registries: z.record(IdSchema, RegistryConfigEntrySchema).default({})
});

export type RegistryConfigEntry = z.infer<typeof RegistryConfigEntrySchema>;
export type RegistryConfig = z.infer<typeof RegistryConfigSchema>;
```

Keep the existing manifest schemas unchanged.

- [ ] **Step 4: Implement the config store**

Create `packages/tutor-core/src/registry/config-store.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { StudyTutorError } from "../errors.js";
import { IdSchema } from "../pack/schema.js";
import { RegistryConfigSchema } from "./schema.js";
import type { RegistryConfig } from "./schema.js";

export interface RegistryConfigStoreOptions {
  configRoot?: string;
}

export interface AddRegistryInput extends RegistryConfigStoreOptions {
  name: string;
  url: string;
}

export interface ResolveRegistryUrlInput extends RegistryConfigStoreOptions {
  name: string;
}

function root(options: RegistryConfigStoreOptions = {}): string {
  return options.configRoot ?? homedir();
}

export function registryConfigPath(configRoot = homedir()): string {
  return join(configRoot, ".study-tutor", "registries.json");
}

function detailsFromUnknown(error: unknown): string[] {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  }
  if (error instanceof Error) {
    return [error.message];
  }
  return [String(error)];
}

function assertRegistryName(name: string): void {
  const result = IdSchema.safeParse(name);
  if (!result.success) {
    throw new StudyTutorError("Invalid registry name", result.error.issues.map((issue) => issue.message));
  }
}

export async function readRegistryConfig(options: RegistryConfigStoreOptions = {}): Promise<RegistryConfig> {
  const file = registryConfigPath(root(options));
  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { registries: {} };
    }
    throw new StudyTutorError("Could not read registry config", detailsFromUnknown(error));
  }

  try {
    return RegistryConfigSchema.parse(JSON.parse(source));
  } catch (error) {
    throw new StudyTutorError("Invalid registry config", detailsFromUnknown(error));
  }
}

export async function writeRegistryConfig(
  config: RegistryConfig,
  options: RegistryConfigStoreOptions = {}
): Promise<void> {
  const file = registryConfigPath(root(options));
  const parsed = RegistryConfigSchema.parse(config);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(parsed, null, 2)}\n`);
}

export async function addRegistry(input: AddRegistryInput): Promise<RegistryConfig> {
  const name = input.name.trim();
  const url = input.url.trim();
  assertRegistryName(name);
  if (!url) {
    throw new StudyTutorError("Registry URL is required");
  }

  const config = await readRegistryConfig({ configRoot: input.configRoot });
  if (config.registries[name]) {
    throw new StudyTutorError(`Registry already exists: ${name}`);
  }

  const nextConfig = {
    registries: {
      ...config.registries,
      [name]: { url }
    }
  };
  await writeRegistryConfig(nextConfig, { configRoot: input.configRoot });
  return nextConfig;
}

export async function resolveRegistryUrl(input: ResolveRegistryUrlInput): Promise<string> {
  const name = input.name.trim();
  assertRegistryName(name);
  const config = await readRegistryConfig({ configRoot: input.configRoot });
  const registry = config.registries[name];
  if (!registry) {
    throw new StudyTutorError(`Unknown registry: ${name}`);
  }
  return registry.url;
}
```

- [ ] **Step 5: Export config store APIs**

Add to `packages/tutor-core/src/index.ts`:

```ts
export {
  addRegistry,
  readRegistryConfig,
  registryConfigPath,
  resolveRegistryUrl,
  writeRegistryConfig
} from "./registry/config-store.js";
export type {
  AddRegistryInput,
  RegistryConfigStoreOptions,
  ResolveRegistryUrlInput
} from "./registry/config-store.js";
export type { RegistryConfig, RegistryConfigEntry } from "./registry/schema.js";
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter @study-tutor/core test -- registry-config-store.test.ts registry-schema.test.ts
pnpm --filter @study-tutor/core typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add packages/tutor-core/src/registry/schema.ts packages/tutor-core/src/registry/config-store.ts packages/tutor-core/src/__tests__/registry-config-store.test.ts packages/tutor-core/src/index.ts
git commit -m "feat: add registry config store"
```

## Task 2: Pack Source Model And Installed Pack Resolver

**Files:**
- Modify: `packages/tutor-core/src/progress/progress-store.ts`
- Create: `packages/tutor-core/src/pack/source-resolver.ts`
- Create: `packages/tutor-core/src/__tests__/pack-source-resolver.test.ts`
- Modify: `packages/tutor-core/src/__tests__/progress-store.test.ts`
- Modify: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write failing source resolver tests**

Create `packages/tutor-core/src/__tests__/pack-source-resolver.test.ts`:

```ts
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { resolveInstalledPackRoot } from "../pack/source-resolver.js";

async function createProject(packLock: unknown): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-pack-source-"));
  await mkdir(join(projectRoot, ".tutor"), { recursive: true });
  await writeFile(join(projectRoot, ".tutor", "pack.lock"), YAML.stringify(packLock));
  return projectRoot;
}

describe("resolveInstalledPackRoot", () => {
  it("returns bundled pack root for bundled source object", async () => {
    const projectRoot = await createProject({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: {
        type: "bundled",
        path: "packs/jpa-tutor-pack"
      }
    });

    const root = await resolveInstalledPackRoot(projectRoot, {
      bundledPackRoot: (packId) => `/bundled/${packId}`
    });

    expect(root).toBe("/bundled/jpa-tutor-pack");
  });

  it("treats legacy string source as bundled", async () => {
    const projectRoot = await createProject({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });

    const root = await resolveInstalledPackRoot(projectRoot, {
      bundledPackRoot: (packId) => `/bundled/${packId}`
    });

    expect(root).toBe("/bundled/jpa-tutor-pack");
  });

  it("returns .tutor/pack for registry source", async () => {
    const projectRoot = await createProject({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/marketplace.git",
        packRepo: "https://github.com/me/jpa-tutor-pack.git",
        ref: "main",
        localSnapshot: ".tutor/pack"
      }
    });
    await mkdir(join(projectRoot, ".tutor", "pack"), { recursive: true });

    const root = await resolveInstalledPackRoot(projectRoot, {
      bundledPackRoot: (packId) => `/bundled/${packId}`
    });

    expect(root).toBe(join(projectRoot, ".tutor", "pack"));
  });

  it("fails when registry source snapshot is missing", async () => {
    const projectRoot = await createProject({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/marketplace.git",
        packRepo: "https://github.com/me/jpa-tutor-pack.git",
        ref: "main",
        localSnapshot: ".tutor/pack"
      }
    });

    await expect(resolveInstalledPackRoot(projectRoot, {
      bundledPackRoot: (packId) => `/bundled/${packId}`
    })).rejects.toThrow("Local registry pack snapshot is missing");
  });
});
```

- [ ] **Step 2: Add progress-store tests for source objects**

Append to `packages/tutor-core/src/__tests__/progress-store.test.ts`:

```ts
it("writes pack.lock with bundled source object", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-progress-"));

  await writePackLock(projectRoot, {
    pack: "jpa-tutor-pack",
    version: "0.1.0",
    course: "mini-hibernate",
    source: {
      type: "bundled",
      path: "packs/jpa-tutor-pack"
    }
  });

  const lock = YAML.parse(await readFile(join(projectRoot, ".tutor", "pack.lock"), "utf8"));
  expect(lock.source).toEqual({
    type: "bundled",
    path: "packs/jpa-tutor-pack"
  });
});

it("reads legacy string source as bundled-compatible pack.lock", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-progress-"));
  await mkdir(join(projectRoot, ".tutor"), { recursive: true });
  await writeFile(join(projectRoot, ".tutor", "pack.lock"), YAML.stringify({
    pack: "jpa-tutor-pack",
    version: "0.1.0",
    course: "mini-hibernate",
    source: "bundled:packs/jpa-tutor-pack"
  }));

  await expect(readPackLock(projectRoot)).resolves.toMatchObject({
    source: "bundled:packs/jpa-tutor-pack"
  });
});
```

If `readPackLock` does not exist yet, this test should fail until Step 4.

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
pnpm --filter @study-tutor/core test -- pack-source-resolver.test.ts progress-store.test.ts
```

Expected: FAIL because `source-resolver.ts`, source object schema, and `readPackLock` are missing.

- [ ] **Step 4: Expand pack lock schema**

Update `packages/tutor-core/src/progress/progress-store.ts`:

```ts
const BundledPackSourceSchema = z.object({
  type: z.literal("bundled"),
  path: z.string().min(1)
});

const RegistryPackSourceSchema = z.object({
  type: z.literal("registry"),
  registryUrl: z.string().min(1),
  packRepo: z.string().min(1),
  ref: z.string().min(1),
  localSnapshot: z.string().min(1)
});

export const PackSourceSchema = z.union([
  z.string().min(1),
  BundledPackSourceSchema,
  RegistryPackSourceSchema
]);

export const PackLockSchema = z.object({
  pack: z.string().min(1),
  version: z.string().min(1),
  course: z.string().min(1),
  source: PackSourceSchema
});
```

Add:

```ts
export type BundledPackSource = z.infer<typeof BundledPackSourceSchema>;
export type RegistryPackSource = z.infer<typeof RegistryPackSourceSchema>;
export type PackSource = z.infer<typeof PackSourceSchema>;

export async function readPackLock(projectRoot: string): Promise<PackLock> {
  const path = join(tutorDir(projectRoot), "pack.lock");
  try {
    return PackLockSchema.parse(YAML.parse(await readFile(path, "utf8")));
  } catch (error) {
    throw new StudyTutorError("Could not read .tutor/pack.lock. Run this command from a study-tutor project root.", [String(error)]);
  }
}
```

Update exports in `packages/tutor-core/src/index.ts` to include `readPackLock` and source types `BundledPackSource`, `RegistryPackSource`, and `PackSource`.

- [ ] **Step 5: Implement installed pack root resolver**

Create `packages/tutor-core/src/pack/source-resolver.ts`:

```ts
import { access } from "node:fs/promises";
import { join } from "node:path";
import { StudyTutorError } from "../errors.js";
import { readPackLock } from "../progress/progress-store.js";

export interface ResolveInstalledPackRootOptions {
  bundledPackRoot: (packId: string) => string;
}

async function assertExists(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new StudyTutorError("Local registry pack snapshot is missing", [path]);
  }
}

export async function resolveInstalledPackRoot(
  projectRoot: string,
  options: ResolveInstalledPackRootOptions
): Promise<string> {
  const packLock = await readPackLock(projectRoot);
  if (typeof packLock.source === "string" || packLock.source.type === "bundled") {
    return options.bundledPackRoot(packLock.pack);
  }

  const snapshot = join(projectRoot, packLock.source.localSnapshot);
  await assertExists(snapshot);
  return snapshot;
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter @study-tutor/core test -- pack-source-resolver.test.ts progress-store.test.ts
pnpm --filter @study-tutor/core typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add packages/tutor-core/src/progress/progress-store.ts packages/tutor-core/src/pack/source-resolver.ts packages/tutor-core/src/__tests__/pack-source-resolver.test.ts packages/tutor-core/src/__tests__/progress-store.test.ts packages/tutor-core/src/index.ts
git commit -m "feat: resolve installed pack sources"
```

## Task 3: Registry Pack Resolver

**Files:**
- Create: `packages/tutor-core/src/registry/pack-resolver.ts`
- Create: `packages/tutor-core/src/__tests__/registry-pack-resolver.test.ts`
- Modify: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write failing registry pack resolver tests**

Create `packages/tutor-core/src/__tests__/registry-pack-resolver.test.ts`:

```ts
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { StudyTutorError } from "../errors.js";
import { resolveRegistryPack } from "../registry/pack-resolver.js";
import type { ClonePackRepository, CheckoutPackRepository } from "../registry/pack-resolver.js";

async function createTempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "study-tutor-registry-pack-"));
}

describe("resolveRegistryPack", () => {
  it("finds a pack in the registry and clones/checks out the pack repo", async () => {
    const tempRoot = await createTempRoot();
    const clonePack = vi.fn<ClonePackRepository>(async ({ destination }) => {
      await mkdir(destination, { recursive: true });
      await writeFile(join(destination, "pack.yaml"), [
        "id: jpa-tutor-pack",
        "name: JPA Tutor Pack",
        "version: 0.1.0",
        "language: java",
        "runtime:",
        "  java: \"21\"",
        "  buildTool: gradle",
        "initialStep: step-01"
      ].join("\n"));
      await writeFile(join(destination, "curriculum.yaml"), [
        "courses:",
        "  - id: mini-hibernate",
        "    title: Mini Hibernate",
        "    status: active",
        "    steps:",
        "      - step-01"
      ].join("\n"));
      await mkdir(join(destination, "steps", "step-01"), { recursive: true });
      await writeFile(join(destination, "steps", "step-01", "step.yaml"), [
        "id: step-01",
        "order: 1",
        "title: Step 01"
      ].join("\n"));
      await writeFile(join(destination, "steps", "step-01", "tck.yaml"), "edgeCases: {}\n");
    });
    const checkout = vi.fn<CheckoutPackRepository>(async () => {});

    const result = await resolveRegistryPack({
      registryUrl: "https://github.com/me/marketplace.git",
      packId: "jpa-tutor-pack",
      tempRoot,
      loadRegistryManifest: async () => ({
        packs: [
          {
            id: "jpa-tutor-pack",
            name: "JPA Tutor Pack",
            description: "Mini Hibernate",
            repo: "https://github.com/me/jpa-tutor-pack.git",
            defaultRef: "main",
            tags: ["java"]
          }
        ]
      }),
      clonePack,
      checkout
    });

    expect(result.pack.metadata.id).toBe("jpa-tutor-pack");
    expect(result.source).toEqual({
      type: "registry",
      registryUrl: "https://github.com/me/marketplace.git",
      packRepo: "https://github.com/me/jpa-tutor-pack.git",
      ref: "main",
      localSnapshot: ".tutor/pack"
    });
    expect(clonePack).toHaveBeenCalledWith({
      url: "https://github.com/me/jpa-tutor-pack.git",
      destination: expect.any(String)
    });
    expect(checkout).toHaveBeenCalledWith({
      repositoryRoot: expect.any(String),
      ref: "main"
    });
    await result.cleanup();
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("fails when the pack id is not in the registry", async () => {
    const tempRoot = await createTempRoot();

    await expect(resolveRegistryPack({
      registryUrl: "https://github.com/me/marketplace.git",
      packId: "missing-pack",
      tempRoot,
      loadRegistryManifest: async () => ({ packs: [] })
    })).rejects.toThrow("Pack missing-pack was not found in registry");
  });

  it("wraps checkout failures with details", async () => {
    const tempRoot = await createTempRoot();
    const clonePack: ClonePackRepository = async ({ destination }) => {
      await mkdir(destination, { recursive: true });
    };

    await expect(resolveRegistryPack({
      registryUrl: "https://github.com/me/marketplace.git",
      packId: "jpa-tutor-pack",
      tempRoot,
      loadRegistryManifest: async () => ({
        packs: [{
          id: "jpa-tutor-pack",
          name: "JPA Tutor Pack",
          description: "Mini Hibernate",
          repo: "https://github.com/me/jpa-tutor-pack.git",
          defaultRef: "bad-ref",
          tags: []
        }]
      }),
      clonePack,
      checkout: async () => {
        throw new Error("pathspec bad-ref did not match");
      }
    })).rejects.toMatchObject({
      message: "Failed to checkout pack ref",
      details: ["pathspec bad-ref did not match"]
    });
  });
});
```

- [ ] **Step 2: Run resolver tests and verify they fail**

Run:

```bash
pnpm --filter @study-tutor/core test -- registry-pack-resolver.test.ts
```

Expected: FAIL because `registry/pack-resolver.ts` does not exist.

- [ ] **Step 3: Implement pack resolver**

Create `packages/tutor-core/src/registry/pack-resolver.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { StudyTutorError } from "../errors.js";
import { loadTutorPack } from "../pack/loader.js";
import { loadRegistryManifest as defaultLoadRegistryManifest } from "./loader.js";
import type { LoadedTutorPack } from "../pack/schema.js";
import type { PackSource, RegistryPackSource } from "../progress/progress-store.js";
import type { RegistryManifest } from "./schema.js";

export interface ClonePackRepositoryInput {
  url: string;
  destination: string;
}

export interface CheckoutPackRepositoryInput {
  repositoryRoot: string;
  ref: string;
}

export type ClonePackRepository = (input: ClonePackRepositoryInput) => Promise<void>;
export type CheckoutPackRepository = (input: CheckoutPackRepositoryInput) => Promise<void>;

export interface ResolveRegistryPackInput {
  registryUrl: string;
  packId: string;
  tempRoot?: string;
  loadRegistryManifest?: (input: { url: string }) => Promise<RegistryManifest>;
  clonePack?: ClonePackRepository;
  checkout?: CheckoutPackRepository;
  cleanup?: (path: string) => Promise<void>;
}

export interface ResolvedRegistryPack {
  pack: LoadedTutorPack;
  packRoot: string;
  source: RegistryPackSource;
  cleanup: () => Promise<void>;
}

function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function clonePackRepositoryWithGit(input: ClonePackRepositoryInput): Promise<void> {
  try {
    await execa("git", ["clone", "--depth", "1", "--", input.url, input.destination], {
      all: true
    });
  } catch (error) {
    throw new StudyTutorError("Failed to clone pack repository", [detail(error)]);
  }
}

export async function checkoutPackRepositoryWithGit(input: CheckoutPackRepositoryInput): Promise<void> {
  try {
    await execa("git", ["checkout", "--detach", input.ref], {
      cwd: input.repositoryRoot,
      all: true
    });
  } catch (error) {
    throw new StudyTutorError("Failed to checkout pack ref", [detail(error)]);
  }
}

export async function resolveRegistryPack(input: ResolveRegistryPackInput): Promise<ResolvedRegistryPack> {
  const registry = await (input.loadRegistryManifest ?? defaultLoadRegistryManifest)({ url: input.registryUrl });
  const entry = registry.packs.find((candidate) => candidate.id === input.packId);
  if (!entry) {
    throw new StudyTutorError(`Pack ${input.packId} was not found in registry`, [input.registryUrl]);
  }

  const root = await mkdtemp(join(input.tempRoot ?? tmpdir(), "study-tutor-pack-"));
  const cleanup = input.cleanup ?? ((path: string) => rm(path, { recursive: true, force: true }));
  let primaryError: unknown;
  try {
    try {
      await (input.clonePack ?? clonePackRepositoryWithGit)({
        url: entry.repo,
        destination: root
      });
      await (input.checkout ?? checkoutPackRepositoryWithGit)({
        repositoryRoot: root,
        ref: entry.defaultRef
      });
    } catch (error) {
      if (error instanceof StudyTutorError) {
        throw error;
      }
      throw new StudyTutorError("Failed to resolve registry pack", [detail(error)]);
    }

    const pack = await loadTutorPack(root);
    return {
      pack,
      packRoot: root,
      source: {
        type: "registry",
        registryUrl: input.registryUrl,
        packRepo: entry.repo,
        ref: entry.defaultRef,
        localSnapshot: ".tutor/pack"
      },
      cleanup: () => cleanup(root)
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (primaryError) {
      await cleanup(root).catch(() => {});
    }
  }
}
```

The resolver intentionally keeps the temp root for successful install so the caller can snapshot it; cleanup on success happens in Task 4 after the snapshot is copied.

- [ ] **Step 4: Export resolver APIs**

Add to `packages/tutor-core/src/index.ts`:

```ts
export {
  checkoutPackRepositoryWithGit,
  clonePackRepositoryWithGit,
  resolveRegistryPack
} from "./registry/pack-resolver.js";
export type {
  CheckoutPackRepository,
  CheckoutPackRepositoryInput,
  ClonePackRepository,
  ClonePackRepositoryInput,
  ResolveRegistryPackInput,
  ResolvedRegistryPack
} from "./registry/pack-resolver.js";
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @study-tutor/core test -- registry-pack-resolver.test.ts registry-loader.test.ts
pnpm --filter @study-tutor/core typecheck
```

Expected: PASS. The success path retains the cloned pack root until `result.cleanup()` is called, so the test should call cleanup after asserting the resolved pack.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add packages/tutor-core/src/registry/pack-resolver.ts packages/tutor-core/src/__tests__/registry-pack-resolver.test.ts packages/tutor-core/src/index.ts
git commit -m "feat: resolve packs from registries"
```

## Task 4: Registry Snapshot Install

**Files:**
- Modify: `packages/tutor-core/src/pack/installer.ts`
- Modify: `packages/tutor-core/src/fs/copy.ts`
- Modify: `packages/tutor-core/src/__tests__/installer.test.ts`
- Modify: `packages/tutor-core/src/__tests__/safe-copy.test.ts`
- Modify: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write failing installer snapshot tests**

Add to `packages/tutor-core/src/__tests__/installer.test.ts`:

```ts
it("writes bundled pack.lock source object for bundled installs", async () => {
  const pack = await loadTutorPack(bundledPackRoot());
  const projectRoot = join(await mkdtemp(join(tmpdir(), "study-tutor-installer-")), "project");

  await installTutorProject({
    pack,
    projectRoot,
    courseId: "mini-hibernate",
    source: {
      type: "bundled",
      path: "packs/jpa-tutor-pack"
    }
  });

  const packLock = YAML.parse(await readFile(join(projectRoot, ".tutor", "pack.lock"), "utf8"));
  expect(packLock.source).toEqual({
    type: "bundled",
    path: "packs/jpa-tutor-pack"
  });
});

it("copies a registry pack snapshot into .tutor/pack", async () => {
  const pack = await loadTutorPack(bundledPackRoot());
  const projectRoot = join(await mkdtemp(join(tmpdir(), "study-tutor-installer-")), "project");

  await installTutorProject({
    pack,
    projectRoot,
    courseId: "mini-hibernate",
    source: {
      type: "registry",
      registryUrl: "https://github.com/me/marketplace.git",
      packRepo: "https://github.com/me/jpa-tutor-pack.git",
      ref: "main",
      localSnapshot: ".tutor/pack"
    },
    snapshotSourceRoot: pack.root
  });

  await expect(readFile(join(projectRoot, ".tutor", "pack", "pack.yaml"), "utf8")).resolves.toContain(
    "id: jpa-tutor-pack"
  );
  await expect(access(join(projectRoot, ".tutor", "pack", ".git"))).rejects.toThrow();
  const packLock = YAML.parse(await readFile(join(projectRoot, ".tutor", "pack.lock"), "utf8"));
  expect(packLock.source).toMatchObject({
    type: "registry",
    localSnapshot: ".tutor/pack"
  });
});
```

- [ ] **Step 2: Run installer tests and verify they fail**

Run:

```bash
pnpm --filter @study-tutor/core test -- installer.test.ts
```

Expected: FAIL because `InstallTutorProjectInput.source` is still string and no snapshot is copied.

- [ ] **Step 3: Let safe copy skip `.git` for pack snapshots**

Modify `packages/tutor-core/src/fs/copy.ts`:

```ts
export interface CopyDirectoryOptions {
  containmentRoot?: string;
  ignoredDirectoryNames?: string[];
}
```

Thread `ignoredDirectoryNames` into `listFiles`. When iterating directory entries, skip a directory entry if its name is included in `ignoredDirectoryNames`.

Add a focused test to `packages/tutor-core/src/__tests__/safe-copy.test.ts`:

```ts
it("skips ignored directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "study-tutor-copy-"));
  const source = join(root, "source");
  const target = join(root, "target");
  await mkdir(join(source, ".git"), { recursive: true });
  await mkdir(join(source, "steps"), { recursive: true });
  await writeFile(join(source, ".git", "config"), "private git metadata");
  await writeFile(join(source, "pack.yaml"), "id: sample-pack");
  await writeFile(join(source, "steps", "step.yaml"), "id: step-01");

  await copyDirectoryWithoutOverwrite(source, target, {
    ignoredDirectoryNames: [".git"]
  });

  await expect(readFile(join(target, "pack.yaml"), "utf8")).resolves.toBe("id: sample-pack");
  await expect(readFile(join(target, "steps", "step.yaml"), "utf8")).resolves.toBe("id: step-01");
  await expect(access(join(target, ".git", "config"))).rejects.toThrow();
});
```

- [ ] **Step 4: Update install input and snapshot copy**

Modify `packages/tutor-core/src/pack/installer.ts`:

```ts
import type { PackSource } from "../progress/progress-store.js";

export interface InstallTutorProjectInput {
  pack: LoadedTutorPack;
  projectRoot: string;
  courseId: string;
  source: PackSource;
  snapshotSourceRoot?: string;
}
```

After `installStepArtifacts(...)` and before `writeProgress(...)`, add:

```ts
if (typeof input.source !== "string" && input.source.type === "registry") {
  if (!input.snapshotSourceRoot) {
    throw new StudyTutorError("Registry installs require a pack snapshot source root");
  }
  await copyDirectoryWithoutOverwrite(input.snapshotSourceRoot, join(input.projectRoot, input.source.localSnapshot), {
    containmentRoot: input.projectRoot,
    ignoredDirectoryNames: [".git"]
  });
}
```

Keep the existing rollback behavior so a snapshot copy failure removes the whole project.

- [ ] **Step 5: Update existing installer tests to use bundled source object**

Replace existing calls that pass:

```ts
source: "bundled:packs/jpa-tutor-pack"
```

with:

```ts
source: {
  type: "bundled",
  path: "packs/jpa-tutor-pack"
}
```

If a test explicitly verifies legacy string compatibility, keep that in `progress-store.test.ts`, not installer install output tests.

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter @study-tutor/core test -- installer.test.ts progress-store.test.ts pack-source-resolver.test.ts safe-copy.test.ts
pnpm --filter @study-tutor/core typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add packages/tutor-core/src/pack/installer.ts packages/tutor-core/src/fs/copy.ts packages/tutor-core/src/__tests__/installer.test.ts packages/tutor-core/src/__tests__/safe-copy.test.ts packages/tutor-core/src/index.ts
git commit -m "feat: snapshot registry packs on install"
```

## Task 5: Status And Next Use Pack Source Resolver

**Files:**
- Modify: `apps/cli/src/commands/status.ts`
- Modify: `apps/cli/src/commands/next.ts`
- Modify: `apps/cli/src/__tests__/next-command.test.ts`
- Create or modify: `apps/cli/src/__tests__/status-command.test.ts`

- [ ] **Step 1: Write failing status command test**

Create `apps/cli/src/__tests__/status-command.test.ts`:

```ts
import { loadTutorPack, readProgress, resolveInstalledPackRoot } from "@study-tutor/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runStatusCommand } from "../commands/status.js";

vi.mock("@study-tutor/core", () => ({
  loadTutorPack: vi.fn(),
  readProgress: vi.fn(),
  resolveInstalledPackRoot: vi.fn()
}));

beforeEach(() => {
  vi.mocked(readProgress).mockResolvedValue({
    pack: "jpa-tutor-pack",
    version: "0.1.0",
    course: "mini-hibernate",
    currentStep: "step-01",
    completedSteps: []
  });
  vi.mocked(resolveInstalledPackRoot).mockResolvedValue("/project/.tutor/pack");
  vi.mocked(loadTutorPack).mockResolvedValue({
    activeCourses: [{ id: "mini-hibernate", title: "Mini Hibernate", status: "active", steps: ["step-01"] }],
    steps: [{ id: "step-01", order: 1, title: "Step 01", root: "/pack/steps/step-01", tck: { edgeCases: [] } }],
    stepById: new Map([["step-01", { id: "step-01", order: 1, title: "Step 01", root: "/pack/steps/step-01", tck: { edgeCases: [] } }]])
  } as Awaited<ReturnType<typeof loadTutorPack>>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runStatusCommand", () => {
  it("loads the pack through the installed pack source resolver", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runStatusCommand("/project");

    expect(resolveInstalledPackRoot).toHaveBeenCalledWith("/project", expect.objectContaining({
      bundledPackRoot: expect.any(Function)
    }));
    expect(loadTutorPack).toHaveBeenCalledWith("/project/.tutor/pack");
  });
});
```

- [ ] **Step 2: Update next command test expectation**

In `apps/cli/src/__tests__/next-command.test.ts`, update the core mock to include `resolveInstalledPackRoot`, set it to return `"/project/.tutor/pack"`, and assert `loadTutorPack` receives that path.

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
pnpm --filter @study-tutor/cli test -- status-command.test.ts next-command.test.ts
```

Expected: FAIL because status and next still call `bundledPackRoot(progress.pack)` directly.

- [ ] **Step 4: Update status command**

Modify `apps/cli/src/commands/status.ts`:

```ts
import { loadTutorPack, readProgress, resolveInstalledPackRoot } from "@study-tutor/core";
import { bundledPackRoot } from "../paths.js";
```

Inside `runStatusCommand`, replace:

```ts
const pack = await loadTutorPack(bundledPackRoot(progress.pack));
```

with:

```ts
const packRoot = await resolveInstalledPackRoot(projectRoot, { bundledPackRoot });
const pack = await loadTutorPack(packRoot);
```

Update the missing course/step error text from `bundled pack` to `installed pack`.

- [ ] **Step 5: Update next command**

Modify `apps/cli/src/commands/next.ts` similarly:

```ts
import { advanceToNextStep, loadTutorPack, readProgress, resolveInstalledPackRoot, StudyTutorError } from "@study-tutor/core";
import { bundledPackRoot } from "../paths.js";
```

Replace:

```ts
const pack = await loadTutorPack(bundledPackRoot(progress.pack));
```

with:

```ts
const packRoot = await resolveInstalledPackRoot(projectRoot, { bundledPackRoot });
const pack = await loadTutorPack(packRoot);
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter @study-tutor/cli test -- status-command.test.ts status-output.test.ts next-command.test.ts
pnpm --filter @study-tutor/cli typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

Run:

```bash
git add apps/cli/src/commands/status.ts apps/cli/src/commands/next.ts apps/cli/src/__tests__/status-command.test.ts apps/cli/src/__tests__/next-command.test.ts
git commit -m "feat: load installed pack sources in cli"
```

## Task 6: Registry Add And Named Registry List CLI

**Files:**
- Modify: `apps/cli/src/commands/registry.ts`
- Modify: `apps/cli/src/__tests__/registry-command.test.ts`
- Modify: `apps/cli/src/index.ts`

- [ ] **Step 1: Write failing registry CLI tests**

Append to `apps/cli/src/__tests__/registry-command.test.ts`:

```ts
it("adds a named registry and prints confirmation", async () => {
  const logs: string[] = [];
  vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
    logs.push(String(message ?? ""));
  });
  vi.mocked(addRegistry).mockResolvedValue({
    registries: {
      official: { url: "https://github.com/me/study-tutor-marketplace.git" }
    }
  });

  await runRegistryAddCommand("official", " https://github.com/me/study-tutor-marketplace.git ");

  expect(addRegistry).toHaveBeenCalledWith({
    name: "official",
    url: "https://github.com/me/study-tutor-marketplace.git"
  });
  expect(logs.join("\n")).toContain("Registry added: official");
  expect(logs.join("\n")).toContain("URL: https://github.com/me/study-tutor-marketplace.git");
});

it("lists packs from a saved registry", async () => {
  vi.mocked(resolveRegistryUrl).mockResolvedValue("https://github.com/me/study-tutor-marketplace.git");
  vi.mocked(loadRegistryManifest).mockResolvedValue({ packs: [] });
  vi.spyOn(console, "log").mockImplementation(() => {});

  await runRegistryListCommand({ registry: "official" });

  expect(resolveRegistryUrl).toHaveBeenCalledWith({ name: "official" });
  expect(loadRegistryManifest).toHaveBeenCalledWith({
    url: "https://github.com/me/study-tutor-marketplace.git"
  });
});

it("fails when registry list receives both registry and url", async () => {
  await expect(runRegistryListCommand({
    registry: "official",
    url: "https://github.com/me/study-tutor-marketplace.git"
  })).rejects.toThrow("Use either --registry or --url, not both");
});

it("fails when registry list receives neither registry nor url", async () => {
  await expect(runRegistryListCommand({})).rejects.toThrow(
    "Missing required option: --registry <name> or --url <git-repo-url>"
  );
});
```

Update the mock at the top to include `addRegistry` and `resolveRegistryUrl`.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter @study-tutor/cli test -- registry-command.test.ts
```

Expected: FAIL because `runRegistryAddCommand` and `--registry` support are missing.

- [ ] **Step 3: Implement registry CLI changes**

Update `apps/cli/src/commands/registry.ts`:

```ts
import { addRegistry, loadRegistryManifest, resolveRegistryUrl, StudyTutorError } from "@study-tutor/core";

export interface RegistryListOptions {
  registry?: string;
  url?: string;
}

export async function runRegistryAddCommand(name: string, url: string): Promise<void> {
  const registryName = name.trim();
  const registryUrl = url.trim();
  await addRegistry({ name: registryName, url: registryUrl });
  console.log([
    `Registry added: ${registryName}`,
    `URL: ${registryUrl}`
  ].join("\n"));
}

async function resolveRegistryListUrl(options: RegistryListOptions): Promise<string> {
  const registry = options.registry?.trim();
  const url = options.url?.trim();
  if (registry && url) {
    throw new Error("Use either --registry or --url, not both");
  }
  if (registry) {
    return resolveRegistryUrl({ name: registry });
  }
  if (url) {
    return url;
  }
  throw new Error("Missing required option: --registry <name> or --url <git-repo-url>");
}
```

Then in `runRegistryListCommand`, replace direct URL validation with:

```ts
const url = await resolveRegistryListUrl(options);
```

Keep the existing `StudyTutorError` detail rethrow behavior.

- [ ] **Step 4: Register registry add and list option**

Update `apps/cli/src/index.ts`:

```ts
import { runRegistryAddCommand, runRegistryListCommand } from "./commands/registry.js";
```

For registry commands:

```ts
registry
  .command("add")
  .argument("<name>")
  .argument("<git-repo-url>")
  .description("Save a marketplace registry URL")
  .action(runRegistryAddCommand);

registry
  .command("list")
  .description("List packs from a marketplace registry")
  .option("--registry <name>", "Saved registry name")
  .option("--url <git-repo-url>", "Git repo URL for the marketplace registry")
  .action((options: { registry?: string; url?: string }) => runRegistryListCommand(options));
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @study-tutor/cli test -- registry-command.test.ts
pnpm --filter @study-tutor/cli typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

Run:

```bash
git add apps/cli/src/commands/registry.ts apps/cli/src/__tests__/registry-command.test.ts apps/cli/src/index.ts
git commit -m "feat: add saved registry commands"
```

## Task 7: Install From Registry CLI

**Files:**
- Modify: `apps/cli/src/commands/install.ts`
- Modify: `apps/cli/src/__tests__/install-command.test.ts`
- Modify: `apps/cli/src/index.ts`

- [ ] **Step 1: Write failing install command tests**

Add to `apps/cli/src/__tests__/install-command.test.ts`:

```ts
it("installs from a saved registry when --registry is provided", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "study-tutor-install-command-"));
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(input).mockResolvedValue("registry-study");
  vi.mocked(resolveRegistryUrl).mockResolvedValue("https://github.com/me/marketplace.git");
  vi.mocked(resolveRegistryPack).mockResolvedValue({
    pack: { metadata: { id: "jpa-tutor-pack" } } as Awaited<ReturnType<typeof resolveRegistryPack>>["pack"],
    packRoot: "/tmp/pack-root",
    source: {
      type: "registry",
      registryUrl: "https://github.com/me/marketplace.git",
      packRepo: "https://github.com/me/jpa-tutor-pack.git",
      ref: "main",
      localSnapshot: ".tutor/pack"
    },
    cleanup: vi.fn()
  });

  await runInstallCommand("jpa-tutor-pack", { registry: "official" });

  expect(resolveRegistryUrl).toHaveBeenCalledWith({ name: "official" });
  expect(resolveRegistryPack).toHaveBeenCalledWith(expect.objectContaining({
    registryUrl: "https://github.com/me/marketplace.git",
    packId: "jpa-tutor-pack"
  }));
  expect(installTutorProject).toHaveBeenCalledWith(expect.objectContaining({
    projectRoot: join(cwd, "registry-study"),
    source: expect.objectContaining({ type: "registry" }),
    snapshotSourceRoot: "/tmp/pack-root"
  }));
});

it("installs from a registry url when --registry-url is provided", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "study-tutor-install-command-"));
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(input).mockResolvedValue("registry-study");
  vi.mocked(resolveRegistryPack).mockResolvedValue({
    pack: { metadata: { id: "jpa-tutor-pack" } } as Awaited<ReturnType<typeof resolveRegistryPack>>["pack"],
    packRoot: "/tmp/pack-root",
    source: {
      type: "registry",
      registryUrl: "https://github.com/me/marketplace.git",
      packRepo: "https://github.com/me/jpa-tutor-pack.git",
      ref: "main",
      localSnapshot: ".tutor/pack"
    },
    cleanup: vi.fn()
  });

  await runInstallCommand("jpa-tutor-pack", {
    registryUrl: " https://github.com/me/marketplace.git "
  });

  expect(resolveRegistryPack).toHaveBeenCalledWith(expect.objectContaining({
    registryUrl: "https://github.com/me/marketplace.git",
    packId: "jpa-tutor-pack"
  }));
});

it("keeps bundled install when no registry options are provided", async () => {
  vi.mocked(input).mockResolvedValue("mini-jpa-study");
  vi.spyOn(console, "log").mockImplementation(() => {});

  await runInstallCommand("jpa-tutor-pack", {});

  expect(loadTutorPack).toHaveBeenCalled();
  expect(resolveRegistryPack).not.toHaveBeenCalled();
  expect(installTutorProject).toHaveBeenCalledWith(expect.objectContaining({
    source: {
      type: "bundled",
      path: "packs/jpa-tutor-pack"
    }
  }));
});

it("fails when both registry options are provided", async () => {
  await expect(runInstallCommand("jpa-tutor-pack", {
    registry: "official",
    registryUrl: "https://github.com/me/marketplace.git"
  })).rejects.toThrow("Use either --registry or --registry-url, not both");
});
```

Update the `@study-tutor/core` mock to include `resolveRegistryUrl` and `resolveRegistryPack`.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter @study-tutor/cli test -- install-command.test.ts
```

Expected: FAIL because `runInstallCommand` does not accept registry options.

- [ ] **Step 3: Implement install option handling**

Update `apps/cli/src/commands/install.ts`:

```ts
import {
  installTutorProject,
  loadTutorPack,
  resolveRegistryPack,
  resolveRegistryUrl,
  StudyTutorError
} from "@study-tutor/core";

export interface InstallCommandOptions {
  registry?: string;
  registryUrl?: string;
}
```

Add helper:

```ts
async function resolveInstallPack(packId: string, options: InstallCommandOptions) {
  const registry = options.registry?.trim();
  const registryUrl = options.registryUrl?.trim();
  if (registry && registryUrl) {
    throw new Error("Use either --registry or --registry-url, not both");
  }

  if (registry || registryUrl) {
    const url = registry ? await resolveRegistryUrl({ name: registry }) : registryUrl;
    if (!url) {
      throw new Error("Missing registry URL");
    }
    const resolved = await resolveRegistryPack({ registryUrl: url, packId });
  return {
    pack: resolved.pack,
    source: resolved.source,
    snapshotSourceRoot: resolved.packRoot,
    cleanup: resolved.cleanup
  };
  }

  if (packId !== "jpa-tutor-pack") {
    throw new Error(`Unsupported pack: ${packId}`);
  }
  return {
    pack: await loadTutorPack(bundledPackRoot(packId)),
    source: {
      type: "bundled" as const,
      path: "packs/jpa-tutor-pack"
    },
    snapshotSourceRoot: undefined,
    cleanup: undefined
  };
}
```

Change signature:

```ts
export async function runInstallCommand(packId: string, options: InstallCommandOptions = {}): Promise<void>
```

Replace bundled-only loading with:

```ts
const resolved = await resolveInstallPack(packId, options);
const pack = resolved.pack;
console.log(`${pack.metadata.name}을 설치합니다.\n`);
```

Pass install input:

```ts
try {
  await installTutorProject({
    pack,
    projectRoot,
    courseId,
    source: resolved.source,
    snapshotSourceRoot: resolved.snapshotSourceRoot
  });
} finally {
  await resolved.cleanup?.();
}
```

If `resolveRegistryPack` throws `StudyTutorError`, preserve detail output the same way `registry.ts` does.

- [ ] **Step 4: Register install options**

Update `apps/cli/src/index.ts` install command:

```ts
program
  .command("install")
  .argument("<pack-id>")
  .option("--registry <name>", "Saved registry name")
  .option("--registry-url <git-repo-url>", "Marketplace registry Git URL")
  .description("Install a tutor pack into a new study project")
  .action((packId: string, options: { registry?: string; registryUrl?: string }) => runInstallCommand(packId, options));
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @study-tutor/cli test -- install-command.test.ts
pnpm --filter @study-tutor/cli typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

Run:

```bash
git add apps/cli/src/commands/install.ts apps/cli/src/__tests__/install-command.test.ts apps/cli/src/index.ts
git commit -m "feat: install packs from registries"
```

## Task 8: Documentation And End-To-End Smoke

**Files:**
- Modify: `README.md`
- Modify: `apps/cli/src/__tests__/e2e-smoke.test.ts`
- Modify: `packs/jpa-tutor-pack/README.md` if needed for registry examples

- [ ] **Step 1: Update README**

In `README.md`, update MVP scope:

```md
- `study-tutor registry add <name> <git-repo-url>` registry URL 저장
- `study-tutor registry list --registry <name>` marketplace 조회
- `study-tutor install <pack-id> --registry <name>` registry pack 설치
```

In the Registry section, add:

````md
Registry URL은 이름으로 저장할 수 있습니다.

```bash
node "$CLI" registry add official https://github.com/me/study-tutor-marketplace.git
node "$CLI" registry list --registry official
node "$CLI" install jpa-tutor-pack --registry official
```

저장하지 않고 한 번만 사용할 수도 있습니다.

```bash
node "$CLI" registry list --url https://github.com/me/study-tutor-marketplace.git
node "$CLI" install jpa-tutor-pack --registry-url https://github.com/me/study-tutor-marketplace.git
```
````

Remove the line that says registry install is not supported.

- [ ] **Step 2: Add CLI E2E registry smoke**

In `apps/cli/src/__tests__/e2e-smoke.test.ts`, add a test that:

1. Creates a temporary pack repo by copying `packs/jpa-tutor-pack`.
2. Runs `git init`, `git add`, and `git commit` in that pack repo.
3. Creates a temporary marketplace repo with `packs.yaml` pointing to the pack repo path.
4. Runs `git init`, `git add`, and `git commit` in the marketplace repo.
5. Runs `node apps/cli/dist/index.js registry add local <marketplace-repo-path>` with `HOME` set to a temp home.
6. Runs `node apps/cli/dist/index.js registry list --registry local` and expects `jpa-tutor-pack`.
7. Runs `node apps/cli/dist/index.js install jpa-tutor-pack --registry local` with prompt input selecting default directory and course.
8. Verifies generated project has `.tutor/pack/pack.yaml`.
9. Runs `status`, `test`, and `next` from the generated project root.

Use existing e2e smoke patterns for invoking the CLI and providing prompt input.

- [ ] **Step 3: Run docs/search verification**

Run:

```bash
rg -n "registry add|--registry|--registry-url|Registry에 등록된 pack 바로 설치|registry 조회만 지원" README.md packs/jpa-tutor-pack/README.md
git diff --check
```

Expected:

- README includes new registry commands.
- Old unsupported registry install wording is gone.
- `git diff --check` passes.

- [ ] **Step 4: Run focused E2E**

Run:

```bash
pnpm --filter @study-tutor/cli test -- e2e-smoke.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 8**

Run:

```bash
git add README.md apps/cli/src/__tests__/e2e-smoke.test.ts packs/jpa-tutor-pack/README.md
git commit -m "docs: document registry installs"
```

If `packs/jpa-tutor-pack/README.md` did not change, omit it from `git add`.

## Task 9: Full Verification And Push

**Files:**
- Verify the whole workspace.

- [ ] **Step 1: Run full test suite**

Run:

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run build**

Run:

```bash
pnpm build
```

Expected: build passes for core and CLI.

- [ ] **Step 3: Check CLI help**

Run:

```bash
node apps/cli/dist/index.js registry --help
node apps/cli/dist/index.js registry add --help
node apps/cli/dist/index.js registry list --help
node apps/cli/dist/index.js install --help
```

Expected:

- `registry` lists `add` and `list`.
- `registry list` shows `--registry` and `--url`.
- `install` shows `--registry` and `--registry-url`.

- [ ] **Step 4: Run manual registry install smoke**

Run a local shell smoke similar to the E2E test:

```bash
tmp="$(mktemp -d)"
CLI="$PWD/apps/cli/dist/index.js"
cp -R packs/jpa-tutor-pack "$tmp/jpa-tutor-pack"
git -C "$tmp/jpa-tutor-pack" init
git -C "$tmp/jpa-tutor-pack" add .
git -C "$tmp/jpa-tutor-pack" -c user.name="Study Tutor" -c user.email="study-tutor@example.com" commit -m "Pack"
mkdir "$tmp/marketplace"
cat > "$tmp/marketplace/packs.yaml" <<YAML
packs:
  - id: jpa-tutor-pack
    name: JPA Tutor Pack
    description: Mini Hibernate를 구현하며 JPA를 배우는 pack
    repo: $tmp/jpa-tutor-pack
    defaultRef: main
    tags:
      - java
      - jpa
YAML
git -C "$tmp/marketplace" init
git -C "$tmp/marketplace" add packs.yaml
git -C "$tmp/marketplace" -c user.name="Study Tutor" -c user.email="study-tutor@example.com" commit -m "Registry"
HOME="$tmp/home" node "$CLI" registry add local "$tmp/marketplace"
HOME="$tmp/home" node "$CLI" registry list --registry local
mkdir "$tmp/workspace"
(cd "$tmp/workspace" && printf '\\n\\n' | HOME="$tmp/home" node "$CLI" install jpa-tutor-pack --registry local)
test -f "$tmp/workspace/mini-jpa-study/.tutor/pack/pack.yaml"
rm -rf "$tmp"
```

Expected: registry add/list succeeds and install creates `mini-jpa-study`.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: only the known untracked `tutor_cli_project_brief.md` remains.

- [ ] **Step 6: Push branch**

Run:

```bash
git push origin feature/tutor-cli-mvp
```

Expected: push succeeds.

## Self-Review Checklist

- Spec coverage: Tasks 1 and 6 cover `registry add` and named registry listing. Tasks 3, 4, and 7 cover registry install, pack repo clone/checkout, and `.tutor/pack` snapshots. Tasks 2 and 5 cover source-object `pack.lock`, legacy string source compatibility, and `status`/`next` local snapshot loading. Task 8 covers docs and E2E smoke. Task 9 covers final verification and push.
- Scope check: The plan does not add registry removal, default registry selection, automatic registry discovery, sha pinning, version ranges, remote services, hidden TCK, or UI.
- Type consistency: `PackSource`, `RegistryPackSource`, `RegistryConfig`, `resolveRegistryPack`, `resolveInstalledPackRoot`, `addRegistry`, and `resolveRegistryUrl` are introduced before CLI tasks depend on them.
- Backward compatibility: Existing bundled install remains the default when no registry option is passed, and legacy string `pack.lock.source` remains readable as bundled source.
- Test isolation: Registry config tests inject `configRoot`, registry resolver tests inject clone/checkout functions, and E2E smoke uses local temporary Git repositories instead of GitHub.
