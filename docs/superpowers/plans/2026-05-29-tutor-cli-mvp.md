# Tutor CLI Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 `study-tutor` CLI MVP that installs and advances a local JPA Tutor Pack through step 3 with learner tests, public sanity tests, and public edge-case TCK checks.

**Architecture:** Use a pnpm TypeScript workspace with a thin CLI in `apps/cli` and runtime rules in `packages/tutor-core`. Keep the JPA pack as local bundled content under `packs/jpa-tutor-pack`, while designing core loaders around an explicit pack root path so a local external pack can be supported without rewriting the runtime.

**Tech Stack:** TypeScript, Node.js 20+, pnpm workspaces, Commander, `@inquirer/prompts`, Zod, `yaml`, `fs-extra`, `execa`, `fast-glob`, Vitest, Java 21, Gradle, JUnit 5, AssertJ.

---

## Scope Check

The approved spec covers a complete Phase 1 MVP, but it is one coherent runtime slice: install a bundled pack, read progress, run tests, run TCK, and advance steps. Pack content is intentionally minimal but executable. GitHub App review, hidden TCK server, remote pack registry, and web UI remain outside this plan.

## File Structure

Create or modify these files:

- Create: `package.json` for root workspace scripts and shared dev dependencies.
- Create: `pnpm-workspace.yaml` for workspace package discovery.
- Create: `tsconfig.base.json`, `tsconfig.json`, `vitest.workspace.ts` for shared build and test configuration.
- Create: `apps/cli/package.json`, `apps/cli/tsconfig.json`, `apps/cli/src/index.ts`.
- Create: `apps/cli/src/commands/install.ts`, `status.ts`, `test.ts`, `next.ts`.
- Create: `packages/tutor-core/package.json`, `packages/tutor-core/tsconfig.json`.
- Create: `packages/tutor-core/src/errors.ts`, `index.ts`.
- Create: `packages/tutor-core/src/pack/schema.ts`, `loader.ts`, `installer.ts`.
- Create: `packages/tutor-core/src/progress/progress-store.ts`.
- Create: `packages/tutor-core/src/steps/step-service.ts`.
- Create: `packages/tutor-core/src/test/gradle-runner.ts`, `tck-runner.ts`.
- Create: `packages/tutor-core/src/fs/copy.ts` for safe copy and collision detection.
- Create: `packages/tutor-core/src/__tests__/*.test.ts` for core unit tests.
- Create: `packs/jpa-tutor-pack/**` for pack metadata, Gradle template, step docs, public tests, and TCK tests.
- Create: `examples/fixtures/step01-solution/**` for E2E smoke test source files.
- Modify: `README.md` with philosophy, setup, commands, and MVP limits.

Each core file has one responsibility:

- `schema.ts`: Zod schemas and exported TypeScript types for pack files.
- `loader.ts`: Load and validate pack metadata, curriculum, steps, and TCK metadata from a pack root.
- `installer.ts`: Create a learning project by copying template and first step artifacts.
- `progress-store.ts`: Read and write `.tutor/progress.json` and `.tutor/pack.lock`.
- `copy.ts`: Safe file copy utilities that never overwrite existing user files.
- `gradle-runner.ts`: Execute `./gradlew test` and return structured success/failure output.
- `tck-runner.ts`: Copy current step TCK files temporarily into `src/test/java`, execute them, map failures to `tck.yaml`, and clean temporary files.
- `step-service.ts`: Enforce `next` policy and advance progress after all checks pass.

## Task 1: Bootstrap Workspace

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`
- Create: `vitest.workspace.ts`
- Create: `apps/cli/package.json`
- Create: `apps/cli/tsconfig.json`
- Create: `apps/cli/src/index.ts`
- Create: `packages/tutor-core/package.json`
- Create: `packages/tutor-core/tsconfig.json`
- Create: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write workspace package files**

Use these exact contents.

`.gitignore`:

```gitignore
node_modules/
dist/
.turbo/
.DS_Store
coverage/
```

`package.json`:

```json
{
  "name": "study-tutor",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "build": "pnpm -r build",
    "typecheck": "pnpm build && pnpm -r typecheck",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "cli": "pnpm --filter @study-tutor/cli dev"
  },
  "devDependencies": {
    "@types/fs-extra": "^11.0.4",
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

`tsconfig.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "files": [],
  "references": [
    { "path": "./packages/tutor-core" },
    { "path": "./apps/cli" }
  ]
}
```

`vitest.workspace.ts`:

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/tutor-core",
  "apps/cli"
]);
```

- [ ] **Step 2: Write package files**

`packages/tutor-core/package.json`:

```json
{
  "name": "@study-tutor/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "execa": "^9.5.2",
    "fast-glob": "^3.3.2",
    "fs-extra": "^11.2.0",
    "yaml": "^2.6.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

`packages/tutor-core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true,
    "tsBuildInfoFile": "dist/.tsbuildinfo"
  },
  "include": ["src/**/*.ts"]
}
```

`apps/cli/package.json`:

```json
{
  "name": "@study-tutor/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "study-tutor": "./dist/index.js"
  },
  "scripts": {
    "build": "pnpm --filter @study-tutor/core build && tsc -p tsconfig.json",
    "dev": "pnpm --filter @study-tutor/core build && tsx src/index.ts",
    "typecheck": "pnpm --filter @study-tutor/core build && tsc -p tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@inquirer/prompts": "^7.2.1",
    "@study-tutor/core": "workspace:*",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

`apps/cli/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true,
    "tsBuildInfoFile": "dist/.tsbuildinfo"
  },
  "references": [
    { "path": "../../packages/tutor-core" }
  ],
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write stub entrypoints**

`packages/tutor-core/src/index.ts`:

```ts
export const STUDY_TUTOR_CORE_VERSION = "0.1.0";
```

`apps/cli/src/index.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { STUDY_TUTOR_CORE_VERSION } from "@study-tutor/core";

const program = new Command();

program
  .name("study-tutor")
  .description("CLI learning runtime for tutor packs")
  .version(STUDY_TUTOR_CORE_VERSION);

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Install dependencies and verify build**

Run:

```bash
pnpm install
pnpm build
pnpm test
```

Expected:

```text
pnpm build
... packages/tutor-core build succeeds
... apps/cli build succeeds

pnpm test
No test files found, exiting with code 0
```

Root Vitest uses `--passWithNoTests` so Task 1 can use `pnpm test` as a bootstrap verification gate before Task 2 adds tests.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json vitest.workspace.ts apps packages
git commit -m "chore: bootstrap pnpm workspace"
```

## Task 2: Pack Schema And Loader

**Files:**
- Create: `packages/tutor-core/src/errors.ts`
- Create: `packages/tutor-core/src/pack/schema.ts`
- Create: `packages/tutor-core/src/pack/loader.ts`
- Create: `packages/tutor-core/src/__tests__/pack-loader.test.ts`
- Modify: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write failing loader tests**

`packages/tutor-core/src/__tests__/pack-loader.test.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadTutorPack } from "../pack/loader.js";

async function createPackFixture() {
  const root = await mkdtemp(join(tmpdir(), "study-tutor-pack-"));
  await mkdir(join(root, "steps", "step-01"), { recursive: true });
  await writeFile(join(root, "pack.yaml"), [
    "id: jpa-tutor-pack",
    "name: JPA Tutor Pack",
    "version: 0.1.0",
    "language: java",
    "runtime:",
    "  java: \"21\"",
    "  buildTool: gradle",
    "initialStep: step-01"
  ].join("\n"));
  await writeFile(join(root, "curriculum.yaml"), [
    "courses:",
    "  - id: mini-hibernate",
    "    title: Mini Hibernate로 배우는 JPA",
    "    status: active",
    "    steps:",
    "      - step-01",
    "  - id: jpa-concepts-practice",
    "    title: JPA 개념 중심 실습",
    "    status: coming-soon"
  ].join("\n"));
  await writeFile(join(root, "steps", "step-01", "step.yaml"), [
    "id: step-01",
    "order: 1",
    "title: Entity Annotation 만들기"
  ].join("\n"));
  await writeFile(join(root, "steps", "step-01", "tck.yaml"), [
    "edgeCases:",
    "  annotation-runtime-retention:",
    "    testClass: tutortck.step01.EntityAnnotationRetentionTckTest",
    "    title: 런타임 Retention",
    "    whyImportant: Reflection으로 annotation을 읽으려면 RUNTIME retention이 필요합니다.",
    "    hint: RetentionPolicy.RUNTIME을 사용하세요."
  ].join("\n"));
  return root;
}

describe("loadTutorPack", () => {
  it("loads pack metadata, active curriculum, steps, and TCK metadata", async () => {
    const root = await createPackFixture();

    const pack = await loadTutorPack(root);

    expect(pack.root).toBe(root);
    expect(pack.metadata.id).toBe("jpa-tutor-pack");
    expect(pack.activeCourses).toHaveLength(1);
    expect(pack.comingSoonCourses).toHaveLength(1);
    expect(pack.steps.map((step) => step.id)).toEqual(["step-01"]);
    expect(pack.stepById.get("step-01")?.tck.edgeCases[0]).toMatchObject({
      id: "annotation-runtime-retention",
      testClass: "tutortck.step01.EntityAnnotationRetentionTckTest"
    });
  });

  it("fails when initialStep is not part of an active course", async () => {
    const root = await createPackFixture();
    await writeFile(join(root, "pack.yaml"), [
      "id: jpa-tutor-pack",
      "name: JPA Tutor Pack",
      "version: 0.1.0",
      "language: java",
      "runtime:",
      "  java: \"21\"",
      "  buildTool: gradle",
      "initialStep: missing-step"
    ].join("\n"));

    await expect(loadTutorPack(root)).rejects.toThrow("initialStep missing-step is not listed in an active course");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/pack-loader.test.ts
```

Expected: FAIL because `../pack/loader.js` does not exist.

- [ ] **Step 3: Implement schemas and loader**

`packages/tutor-core/src/errors.ts`:

```ts
export class StudyTutorError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message);
    this.name = "StudyTutorError";
  }
}
```

`packages/tutor-core/src/pack/schema.ts`:

```ts
import { z } from "zod";

export const PackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  language: z.literal("java"),
  runtime: z.object({
    java: z.string().min(1),
    buildTool: z.literal("gradle")
  }),
  initialStep: z.string().min(1)
});

export const CourseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["active", "coming-soon"]),
  steps: z.array(z.string().min(1)).optional()
});

export const CurriculumSchema = z.object({
  courses: z.array(CourseSchema).min(1)
});

export const StepSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1)
});

export const TckSchema = z.object({
  edgeCases: z.record(z.object({
    testClass: z.string().min(1),
    title: z.string().min(1),
    whyImportant: z.string().min(1),
    hint: z.string().min(1)
  })).default({})
});

export type PackMetadata = z.infer<typeof PackSchema>;
export type Course = z.infer<typeof CourseSchema>;
export type Curriculum = z.infer<typeof CurriculumSchema>;
export type StepMetadata = z.infer<typeof StepSchema>;
export type TckMetadataFile = z.infer<typeof TckSchema>;

export interface TckEdgeCase {
  id: string;
  testClass: string;
  title: string;
  whyImportant: string;
  hint: string;
}

export interface LoadedStep {
  id: string;
  order: number;
  title: string;
  root: string;
  tck: {
    edgeCases: TckEdgeCase[];
  };
}

export interface LoadedTutorPack {
  root: string;
  metadata: PackMetadata;
  curriculum: Curriculum;
  activeCourses: Course[];
  comingSoonCourses: Course[];
  steps: LoadedStep[];
  stepById: Map<string, LoadedStep>;
}
```

`packages/tutor-core/src/pack/loader.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { StudyTutorError } from "../errors.js";
import {
  CurriculumSchema,
  LoadedStep,
  LoadedTutorPack,
  PackSchema,
  StepSchema,
  TckEdgeCase,
  TckSchema
} from "./schema.js";

async function readYamlFile(path: string): Promise<unknown> {
  const source = await readFile(path, "utf8");
  return YAML.parse(source);
}

function formatZodError(file: string, error: unknown): StudyTutorError {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ path: Array<string | number>; message: string }> }).issues;
    return new StudyTutorError(`Invalid ${file}`, issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }
  return new StudyTutorError(`Invalid ${file}`, [String(error)]);
}

async function parseYamlWithSchema<T>(file: string, schema: { parse: (value: unknown) => T }): Promise<T> {
  try {
    return schema.parse(await readYamlFile(file));
  } catch (error) {
    throw formatZodError(file, error);
  }
}

async function loadStep(packRoot: string, stepId: string): Promise<LoadedStep> {
  const stepRoot = join(packRoot, "steps", stepId);
  const step = await parseYamlWithSchema(join(stepRoot, "step.yaml"), StepSchema);
  const tckFile = await parseYamlWithSchema(join(stepRoot, "tck.yaml"), TckSchema);
  const edgeCases: TckEdgeCase[] = Object.entries(tckFile.edgeCases).map(([id, value]) => ({
    id,
    ...value
  }));

  return {
    id: step.id,
    order: step.order,
    title: step.title,
    root: stepRoot,
    tck: { edgeCases }
  };
}

export async function loadTutorPack(packRoot: string): Promise<LoadedTutorPack> {
  const metadata = await parseYamlWithSchema(join(packRoot, "pack.yaml"), PackSchema);
  const curriculum = await parseYamlWithSchema(join(packRoot, "curriculum.yaml"), CurriculumSchema);
  const activeCourses = curriculum.courses.filter((course) => course.status === "active");
  const comingSoonCourses = curriculum.courses.filter((course) => course.status === "coming-soon");
  const activeStepIds = activeCourses.flatMap((course) => course.steps ?? []);

  if (!activeStepIds.includes(metadata.initialStep)) {
    throw new StudyTutorError(`initialStep ${metadata.initialStep} is not listed in an active course`);
  }

  const uniqueStepIds = [...new Set(activeStepIds)];
  const steps = (await Promise.all(uniqueStepIds.map((stepId) => loadStep(packRoot, stepId))))
    .sort((a, b) => a.order - b.order);
  const stepById = new Map(steps.map((step) => [step.id, step]));

  return {
    root: packRoot,
    metadata,
    curriculum,
    activeCourses,
    comingSoonCourses,
    steps,
    stepById
  };
}
```

`packages/tutor-core/src/index.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/pack-loader.test.ts
pnpm build
```

Expected: PASS and build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/tutor-core
git commit -m "feat: load tutor pack metadata"
```

## Task 3: Add JPA Pack And Gradle Template

**Files:**
- Create: `packs/jpa-tutor-pack/pack.yaml`
- Create: `packs/jpa-tutor-pack/curriculum.yaml`
- Create: `packs/jpa-tutor-pack/templates/gradle-project/build.gradle`
- Create: `packs/jpa-tutor-pack/templates/gradle-project/settings.gradle`
- Create: `packs/jpa-tutor-pack/templates/gradle-project/README.md`
- Create: `packs/jpa-tutor-pack/templates/gradle-project/src/main/java/io/tutor/minijpa/.gitkeep`
- Create: `packs/jpa-tutor-pack/templates/gradle-project/src/test/java/learner/.gitkeep`
- Create: `packs/jpa-tutor-pack/templates/gradle-project/src/test/java/publictests/.gitkeep`
- Create: `packs/jpa-tutor-pack/steps/step-01-entity-annotations/**`
- Create: `packs/jpa-tutor-pack/steps/step-02-entity-metadata/**`
- Create: `packs/jpa-tutor-pack/steps/step-03-select-sql-generation/**`
- Modify: `packages/tutor-core/src/__tests__/pack-loader.test.ts`

- [ ] **Step 1: Create pack metadata**

`packs/jpa-tutor-pack/pack.yaml`:

```yaml
id: jpa-tutor-pack
name: JPA Tutor Pack
version: 0.1.0
language: java
runtime:
  java: "21"
  buildTool: gradle
initialStep: step-01-entity-annotations
```

`packs/jpa-tutor-pack/curriculum.yaml`:

```yaml
courses:
  - id: mini-hibernate
    title: Mini Hibernate로 배우는 JPA
    status: active
    steps:
      - step-01-entity-annotations
      - step-02-entity-metadata
      - step-03-select-sql-generation
  - id: jpa-concepts-practice
    title: JPA 개념 중심 실습
    status: coming-soon
  - id: spring-data-jpa-practice
    title: Spring Data JPA 실무 패턴
    status: coming-soon
  - id: jpa-interview-focus
    title: 면접 대비 집중 코스
    status: coming-soon
```

- [ ] **Step 2: Create Gradle project template**

`packs/jpa-tutor-pack/templates/gradle-project/build.gradle`:

```gradle
plugins {
    id 'java'
}

group = 'io.tutor'
version = '0.1.0'

repositories {
    mavenCentral()
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter:5.10.2'
    testImplementation 'org.assertj:assertj-core:3.25.3'
}

test {
    useJUnitPlatform()
}
```

`packs/jpa-tutor-pack/templates/gradle-project/settings.gradle`:

```gradle
rootProject.name = 'mini-jpa-study'
```

`packs/jpa-tutor-pack/templates/gradle-project/README.md`:

```md
# Mini JPA Study

이 프로젝트는 `study-tutor`가 생성한 JPA 학습 프로젝트입니다.

## 학습 흐름

1. `.tutor/steps/<current-step>/requirements.md`를 읽습니다.
2. `src/test/java/learner` 아래에 직접 테스트를 작성합니다.
3. `src/main/java/io/tutor/minijpa` 아래에 구현합니다.
4. `study-tutor test`로 learner test와 public sanity test를 실행합니다.
5. 준비되면 `study-tutor next`로 edge-case TCK까지 확인하고 다음 step으로 이동합니다.
```

Create the three `.gitkeep` files listed above as empty files.

- [ ] **Step 3: Generate Gradle wrapper in the template**

Run:

```bash
cd packs/jpa-tutor-pack/templates/gradle-project
gradle wrapper --gradle-version 8.8
cd -
```

Expected generated files:

```text
packs/jpa-tutor-pack/templates/gradle-project/gradlew
packs/jpa-tutor-pack/templates/gradle-project/gradlew.bat
packs/jpa-tutor-pack/templates/gradle-project/gradle/wrapper/gradle-wrapper.jar
packs/jpa-tutor-pack/templates/gradle-project/gradle/wrapper/gradle-wrapper.properties
```

Run:

```bash
chmod +x packs/jpa-tutor-pack/templates/gradle-project/gradlew
```

- [ ] **Step 4: Create step 01 files**

`packs/jpa-tutor-pack/steps/step-01-entity-annotations/step.yaml`:

```yaml
id: step-01-entity-annotations
order: 1
title: Entity Annotation 만들기
```

`packs/jpa-tutor-pack/steps/step-01-entity-annotations/requirements.md`:

```md
# Step 01. Entity Annotation 만들기

## 목적

Mini JPA의 출발점이 되는 runtime annotation을 직접 만든다.

## 요구사항

- `io.tutor.minijpa.Entity`는 클래스에 붙일 수 있어야 한다.
- `Entity`는 runtime reflection으로 읽을 수 있어야 한다.
- `io.tutor.minijpa.Table`은 클래스에 붙일 수 있어야 한다.
- `Table`은 `String name()` 속성을 가져야 한다.
- `io.tutor.minijpa.Id`는 필드에 붙일 수 있어야 한다.
- `io.tutor.minijpa.Column`은 필드에 붙일 수 있어야 한다.
- `Column`은 `String name()` 속성을 가져야 한다.

## 구현 위치

- `src/main/java/io/tutor/minijpa/Entity.java`
- `src/main/java/io/tutor/minijpa/Table.java`
- `src/main/java/io/tutor/minijpa/Id.java`
- `src/main/java/io/tutor/minijpa/Column.java`
```

`packs/jpa-tutor-pack/steps/step-01-entity-annotations/test-guide.md`:

```md
# Step 01 테스트 작성 가이드

`src/test/java/learner` 아래에 직접 테스트를 작성한다.

추천 테스트:

- `@Entity`가 클래스에 붙고 runtime에 읽히는지 확인한다.
- `@Table(name = "members")` 값을 reflection으로 읽는다.
- `@Id`가 필드에 붙는지 확인한다.
- `@Column(name = "member_name")` 값을 reflection으로 읽는다.
- annotation의 `@Target`과 `@Retention` 정책을 확인한다.
```

`packs/jpa-tutor-pack/steps/step-01-entity-annotations/review-rubric.md`:

```md
# Step 01 Review Rubric

- annotation package가 `io.tutor.minijpa`인가?
- class-level annotation과 field-level annotation의 target이 구분되어 있는가?
- runtime reflection으로 모든 annotation을 읽을 수 있는가?
- `Table.name()`과 `Column.name()`이 빈 문자열 없이 명시적으로 동작하는가?
```

`packs/jpa-tutor-pack/steps/step-01-entity-annotations/public-tests/EntityAnnotationSanityTest.java`:

```java
package publictests.step01;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

class EntityAnnotationSanityTest {
    @Entity
    @Table(name = "members")
    static class Member {
        @Id
        @Column(name = "id")
        private Long id;

        @Column(name = "member_name")
        private String name;
    }

    @Test
    void classAnnotationsAreReadableAtRuntime() {
        assertThat(Member.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Member.class.getAnnotation(Table.class).name()).isEqualTo("members");
    }

    @Test
    void fieldAnnotationsAreReadableAtRuntime() throws Exception {
        Field id = Member.class.getDeclaredField("id");
        Field name = Member.class.getDeclaredField("name");

        assertThat(id.isAnnotationPresent(Id.class)).isTrue();
        assertThat(id.getAnnotation(Column.class).name()).isEqualTo("id");
        assertThat(name.getAnnotation(Column.class).name()).isEqualTo("member_name");
    }
}
```

`packs/jpa-tutor-pack/steps/step-01-entity-annotations/tck-tests/tutortck/step01/EntityAnnotationPolicyTckTest.java`:

```java
package tutortck.step01;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.TYPE;
import static org.assertj.core.api.Assertions.assertThat;

class EntityAnnotationPolicyTckTest {
    @Test
    void entityAndTableMustTargetTypes() {
        assertThat(Entity.class.getAnnotation(Target.class).value()).containsExactly(TYPE);
        assertThat(Table.class.getAnnotation(Target.class).value()).containsExactly(TYPE);
    }

    @Test
    void idAndColumnMustTargetFields() {
        assertThat(Id.class.getAnnotation(Target.class).value()).containsExactly(FIELD);
        assertThat(Column.class.getAnnotation(Target.class).value()).containsExactly(FIELD);
    }

    @Test
    void allAnnotationsMustUseRuntimeRetention() {
        assertThat(Entity.class.getAnnotation(Retention.class).value()).isEqualTo(RetentionPolicy.RUNTIME);
        assertThat(Table.class.getAnnotation(Retention.class).value()).isEqualTo(RetentionPolicy.RUNTIME);
        assertThat(Id.class.getAnnotation(Retention.class).value()).isEqualTo(RetentionPolicy.RUNTIME);
        assertThat(Column.class.getAnnotation(Retention.class).value()).isEqualTo(RetentionPolicy.RUNTIME);
    }
}
```

`packs/jpa-tutor-pack/steps/step-01-entity-annotations/tck.yaml`:

```yaml
edgeCases:
  annotation-target-policy:
    testClass: tutortck.step01.EntityAnnotationPolicyTckTest
    title: Annotation target 정책
    whyImportant: Entity와 Table은 클래스 메타데이터이고 Id와 Column은 필드 메타데이터입니다. target이 섞이면 ORM metadata extractor가 잘못된 위치에서 annotation을 읽게 됩니다.
    hint: Entity와 Table에는 ElementType.TYPE, Id와 Column에는 ElementType.FIELD를 사용하세요.
  annotation-runtime-retention:
    testClass: tutortck.step01.EntityAnnotationPolicyTckTest
    title: Runtime retention 정책
    whyImportant: ORM은 reflection으로 annotation을 읽습니다. RUNTIME retention이 아니면 실행 중 metadata를 만들 수 없습니다.
    hint: 네 annotation 모두 RetentionPolicy.RUNTIME을 사용하세요.
```

- [ ] **Step 5: Create step 02 files**

`packs/jpa-tutor-pack/steps/step-02-entity-metadata/step.yaml`:

```yaml
id: step-02-entity-metadata
order: 2
title: EntityMetadata 추출하기
```

`packs/jpa-tutor-pack/steps/step-02-entity-metadata/requirements.md`:

```md
# Step 02. EntityMetadata 추출하기

## 목적

Step 01에서 만든 annotation을 runtime reflection으로 읽어 ORM metadata를 만든다.

## 요구사항

- `EntityMetadataExtractor.extract(Class<?>)`를 구현한다.
- `@Entity`가 붙은 클래스만 entity로 인정한다.
- `@Table(name = "...")`에서 table name을 추출한다.
- `@Id`가 붙은 필드를 identifier column으로 인식한다.
- `@Column(name = "...")`에서 column name을 추출한다.
- `EntityMetadata`는 `tableName()`, `idColumn()`, `columns()`를 제공한다.
- `ColumnMetadata`는 `fieldName()`, `columnName()`, `javaType()`, `id()`를 제공한다.

## 구현 위치

- `src/main/java/io/tutor/minijpa/EntityMetadata.java`
- `src/main/java/io/tutor/minijpa/ColumnMetadata.java`
- `src/main/java/io/tutor/minijpa/EntityMetadataExtractor.java`
```

`packs/jpa-tutor-pack/steps/step-02-entity-metadata/test-guide.md`:

```md
# Step 02 테스트 작성 가이드

`src/test/java/learner` 아래에 metadata extraction 테스트를 직접 작성한다.

추천 테스트:

- 정상 entity에서 table name을 추출한다.
- `@Id` 필드가 id column으로 표시되는지 확인한다.
- field name과 column name이 다를 때 column name을 보존하는지 확인한다.
- column 순서가 class field 선언 순서를 따르는지 확인한다.
```

`packs/jpa-tutor-pack/steps/step-02-entity-metadata/review-rubric.md`:

```md
# Step 02 Review Rubric

- 특정 entity class에 하드코딩되어 있지 않은가?
- `Class<?>`와 reflection API를 사용해 generic하게 metadata를 만드는가?
- `@Entity`, `@Id` 누락 같은 invalid mapping을 명확한 예외로 처리하는가?
- 이후 SQL generation에서 사용할 수 있는 column metadata를 충분히 보존하는가?
```

`packs/jpa-tutor-pack/steps/step-02-entity-metadata/public-tests/EntityMetadataSanityTest.java`:

```java
package publictests.step02;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.EntityMetadata;
import io.tutor.minijpa.EntityMetadataExtractor;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EntityMetadataSanityTest {
    @Entity
    @Table(name = "members")
    static class Member {
        @Id
        @Column(name = "id")
        private Long id;

        @Column(name = "member_name")
        private String name;
    }

    @Test
    void extractsTableIdAndColumns() {
        EntityMetadata metadata = new EntityMetadataExtractor().extract(Member.class);

        assertThat(metadata.tableName()).isEqualTo("members");
        assertThat(metadata.idColumn().fieldName()).isEqualTo("id");
        assertThat(metadata.idColumn().columnName()).isEqualTo("id");
        assertThat(metadata.columns()).extracting("columnName").containsExactly("id", "member_name");
    }
}
```

`packs/jpa-tutor-pack/steps/step-02-entity-metadata/tck-tests/tutortck/step02/EntityMetadataEdgeCaseTckTest.java`:

```java
package tutortck.step02;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.EntityMetadataExtractor;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EntityMetadataEdgeCaseTckTest {
    static class NotEntity {
        @Id
        @Column(name = "id")
        private Long id;
    }

    @Entity
    @Table(name = "no_id_members")
    static class EntityWithoutId {
        @Column(name = "name")
        private String name;
    }

    @Entity
    @Table(name = "duplicate_id_members")
    static class EntityWithDuplicateIds {
        @Id
        @Column(name = "id")
        private Long id;

        @Id
        @Column(name = "legacy_id")
        private Long legacyId;
    }

    @Test
    void rejectsClassWithoutEntityAnnotation() {
        assertThatThrownBy(() -> new EntityMetadataExtractor().extract(NotEntity.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("@Entity");
    }

    @Test
    void rejectsEntityWithoutId() {
        assertThatThrownBy(() -> new EntityMetadataExtractor().extract(EntityWithoutId.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("@Id");
    }

    @Test
    void rejectsEntityWithDuplicateIds() {
        assertThatThrownBy(() -> new EntityMetadataExtractor().extract(EntityWithDuplicateIds.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("@Id");
    }
}
```

`packs/jpa-tutor-pack/steps/step-02-entity-metadata/tck.yaml`:

```yaml
edgeCases:
  missing-entity-annotation:
    testClass: tutortck.step02.EntityMetadataEdgeCaseTckTest
    title: "@Entity가 없는 클래스"
    whyImportant: ORM은 모든 Java class를 entity로 보지 않습니다. @Entity가 없는 class를 허용하면 metadata extractor가 관리 대상이 아닌 객체까지 persistence 대상으로 착각합니다.
    hint: EntityMetadataExtractor 시작 부분에서 entityClass.isAnnotationPresent(Entity.class)를 검사하세요.
  missing-id-field:
    testClass: tutortck.step02.EntityMetadataEdgeCaseTckTest
    title: "@Id가 없는 Entity"
    whyImportant: identifier가 없으면 EntityKey, 1차 캐시, dirty checking 기준을 만들 수 없습니다.
    hint: 필드를 순회하면서 @Id 개수를 세고 0개면 IllegalArgumentException을 던지세요.
  duplicate-id-fields:
    testClass: tutortck.step02.EntityMetadataEdgeCaseTckTest
    title: "@Id가 2개 이상인 Entity"
    whyImportant: identifier가 여러 개면 findById SQL과 persistence identity가 모호해집니다.
    hint: MVP에서는 composite key를 지원하지 않으므로 @Id가 정확히 1개일 때만 허용하세요.
```

- [ ] **Step 6: Create step 03 files**

`packs/jpa-tutor-pack/steps/step-03-select-sql-generation/step.yaml`:

```yaml
id: step-03-select-sql-generation
order: 3
title: Select SQL 생성하기
```

`packs/jpa-tutor-pack/steps/step-03-select-sql-generation/requirements.md`:

```md
# Step 03. Select SQL 생성하기

## 목적

Step 02의 EntityMetadata를 기반으로 `findById`에 사용할 SQL을 생성한다.

## 요구사항

- `SelectSqlGenerator.generateFindByIdSql(EntityMetadata)`를 구현한다.
- SELECT 절에는 metadata의 column name을 순서대로 사용한다.
- FROM 절에는 metadata의 table name을 사용한다.
- WHERE 절에는 id column name을 사용한다.
- 값은 직접 문자열로 넣지 않고 `?` parameter marker를 사용한다.

## 구현 위치

- `src/main/java/io/tutor/minijpa/SelectSqlGenerator.java`
```

`packs/jpa-tutor-pack/steps/step-03-select-sql-generation/test-guide.md`:

```md
# Step 03 테스트 작성 가이드

`src/test/java/learner` 아래에 SQL generation 테스트를 직접 작성한다.

추천 테스트:

- column list와 table name으로 select SQL이 만들어지는지 확인한다.
- field name이 아니라 column name을 사용하는지 확인한다.
- id field가 첫 번째 필드가 아니어도 WHERE 절은 id column을 사용하는지 확인한다.
- SQL 값에는 `?` parameter marker를 사용하는지 확인한다.
```

`packs/jpa-tutor-pack/steps/step-03-select-sql-generation/review-rubric.md`:

```md
# Step 03 Review Rubric

- SQL generator가 entity class를 다시 reflection하지 않고 EntityMetadata만 사용하는가?
- field name과 column name을 혼동하지 않는가?
- id column이 column list의 첫 번째라고 가정하지 않는가?
- generated SQL이 deterministic해서 테스트하기 쉬운가?
```

`packs/jpa-tutor-pack/steps/step-03-select-sql-generation/public-tests/SelectSqlGeneratorSanityTest.java`:

```java
package publictests.step03;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.EntityMetadata;
import io.tutor.minijpa.EntityMetadataExtractor;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.SelectSqlGenerator;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SelectSqlGeneratorSanityTest {
    @Entity
    @Table(name = "members")
    static class Member {
        @Id
        @Column(name = "id")
        private Long id;

        @Column(name = "member_name")
        private String name;
    }

    @Test
    void generatesFindByIdSqlFromMetadata() {
        EntityMetadata metadata = new EntityMetadataExtractor().extract(Member.class);

        String sql = new SelectSqlGenerator().generateFindByIdSql(metadata);

        assertThat(sql).isEqualTo("select id, member_name from members where id = ?");
    }
}
```

`packs/jpa-tutor-pack/steps/step-03-select-sql-generation/tck-tests/tutortck/step03/SelectSqlGeneratorEdgeCaseTckTest.java`:

```java
package tutortck.step03;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.EntityMetadata;
import io.tutor.minijpa.EntityMetadataExtractor;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.SelectSqlGenerator;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SelectSqlGeneratorEdgeCaseTckTest {
    @Entity
    @Table(name = "orders")
    static class OrderEntity {
        @Column(name = "order_name")
        private String name;

        @Id
        @Column(name = "order_id")
        private Long id;
    }

    @Test
    void usesIdColumnInWhereClauseEvenWhenIdIsNotFirstField() {
        EntityMetadata metadata = new EntityMetadataExtractor().extract(OrderEntity.class);

        String sql = new SelectSqlGenerator().generateFindByIdSql(metadata);

        assertThat(sql).isEqualTo("select order_name, order_id from orders where order_id = ?");
    }
}
```

`packs/jpa-tutor-pack/steps/step-03-select-sql-generation/tck.yaml`:

```yaml
edgeCases:
  id-column-not-first:
    testClass: tutortck.step03.SelectSqlGeneratorEdgeCaseTckTest
    title: "@Id 필드가 첫 번째 필드가 아닌 Entity"
    whyImportant: ORM은 Java field 선언 순서에 identifier 위치를 의존하면 안 됩니다. WHERE 절은 metadata가 식별한 id column을 사용해야 합니다.
    hint: metadata.columns().get(0)가 아니라 metadata.idColumn().columnName()으로 WHERE 절을 만드세요.
```

- [ ] **Step 7: Extend loader test to read real pack**

Change the existing path import in `packages/tutor-core/src/__tests__/pack-loader.test.ts` from:

```ts
import { join } from "node:path";
```

to:

```ts
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
```

Then add this helper after the imports:

```ts

function repositoryRootFromTestFile() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}
```

Append this test inside the existing `describe("loadTutorPack", () => { ... })` block:

```ts
it("loads the bundled JPA tutor pack", async () => {
  const pack = await loadTutorPack(join(repositoryRootFromTestFile(), "packs", "jpa-tutor-pack"));

  expect(pack.metadata.id).toBe("jpa-tutor-pack");
  expect(pack.steps.map((step) => step.id)).toEqual([
    "step-01-entity-annotations",
    "step-02-entity-metadata",
    "step-03-select-sql-generation"
  ]);
  expect(pack.stepById.get("step-01-entity-annotations")?.tck.edgeCases.length).toBeGreaterThan(0);
});
```

- [ ] **Step 8: Run pack loader tests**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/pack-loader.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packs packages/tutor-core/src/__tests__/pack-loader.test.ts
git commit -m "feat: add bundled jpa tutor pack"
```

## Task 4: Progress Store And Safe Copy

**Files:**
- Create: `packages/tutor-core/src/fs/copy.ts`
- Create: `packages/tutor-core/src/progress/progress-store.ts`
- Create: `packages/tutor-core/src/__tests__/progress-store.test.ts`
- Create: `packages/tutor-core/src/__tests__/safe-copy.test.ts`
- Modify: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write failing tests**

`packages/tutor-core/src/__tests__/progress-store.test.ts`:

```ts
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { readProgress, writePackLock, writeProgress } from "../progress/progress-store.js";

describe("progress-store", () => {
  it("writes and reads progress.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-progress-"));
    await mkdir(join(root, ".tutor"));

    await writeProgress(root, {
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      currentStep: "step-01-entity-annotations",
      completedSteps: []
    });

    await expect(readProgress(root)).resolves.toEqual({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      currentStep: "step-01-entity-annotations",
      completedSteps: []
    });
  });

  it("writes pack.lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-lock-"));
    await mkdir(join(root, ".tutor"));

    await writePackLock(root, {
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });

    const progress = await import("node:fs/promises").then((fs) => fs.readFile(join(root, ".tutor", "pack.lock"), "utf8"));
    expect(progress).toContain("pack: jpa-tutor-pack");
    expect(progress).toContain("source: bundled:packs/jpa-tutor-pack");
  });
});
```

`packages/tutor-core/src/__tests__/safe-copy.test.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { copyDirectoryWithoutOverwrite } from "../fs/copy.js";

describe("copyDirectoryWithoutOverwrite", () => {
  it("copies nested files", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-copy-"));
    const source = join(root, "source");
    const target = join(root, "target");
    await mkdir(join(source, "nested"), { recursive: true });
    await writeFile(join(source, "nested", "file.txt"), "hello");

    await copyDirectoryWithoutOverwrite(source, target);

    await expect(readFile(join(target, "nested", "file.txt"), "utf8")).resolves.toBe("hello");
  });

  it("fails before copying when a target file already exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-copy-conflict-"));
    const source = join(root, "source");
    const target = join(root, "target");
    await mkdir(source, { recursive: true });
    await mkdir(target, { recursive: true });
    await writeFile(join(source, "file.txt"), "new");
    await writeFile(join(target, "file.txt"), "old");

    await expect(copyDirectoryWithoutOverwrite(source, target)).rejects.toThrow("Refusing to overwrite existing files");
    await expect(readFile(join(target, "file.txt"), "utf8")).resolves.toBe("old");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/progress-store.test.ts src/__tests__/safe-copy.test.ts
```

Expected: FAIL because `progress-store.js` and `copy.js` do not exist.

- [ ] **Step 3: Implement safe copy**

`packages/tutor-core/src/fs/copy.ts`:

```ts
import { access, cp, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { StudyTutorError } from "../errors.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry);
    const entryStat = await stat(fullPath);
    if (entryStat.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

export async function copyDirectoryWithoutOverwrite(source: string, target: string): Promise<void> {
  const sourceFiles = await listFiles(source);
  const conflicts: string[] = [];

  for (const sourceFile of sourceFiles) {
    const targetFile = join(target, relative(source, sourceFile));
    if (await exists(targetFile)) {
      conflicts.push(targetFile);
    }
  }

  if (conflicts.length > 0) {
    throw new StudyTutorError("Refusing to overwrite existing files", conflicts);
  }

  for (const sourceFile of sourceFiles) {
    const targetFile = join(target, relative(source, sourceFile));
    await mkdir(dirname(targetFile), { recursive: true });
    await cp(sourceFile, targetFile);
  }
}
```

- [ ] **Step 4: Implement progress store**

`packages/tutor-core/src/progress/progress-store.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { StudyTutorError } from "../errors.js";

export const ProgressSchema = z.object({
  pack: z.string().min(1),
  version: z.string().min(1),
  course: z.string().min(1),
  currentStep: z.string().min(1),
  completedSteps: z.array(z.string())
});

export const PackLockSchema = z.object({
  pack: z.string().min(1),
  version: z.string().min(1),
  course: z.string().min(1),
  source: z.string().min(1)
});

export type Progress = z.infer<typeof ProgressSchema>;
export type PackLock = z.infer<typeof PackLockSchema>;

function tutorDir(projectRoot: string): string {
  return join(projectRoot, ".tutor");
}

export async function readProgress(projectRoot: string): Promise<Progress> {
  const path = join(tutorDir(projectRoot), "progress.json");
  try {
    return ProgressSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    throw new StudyTutorError("Could not read .tutor/progress.json. Run this command from a study-tutor project root.", [String(error)]);
  }
}

export async function writeProgress(projectRoot: string, progress: Progress): Promise<void> {
  await mkdir(tutorDir(projectRoot), { recursive: true });
  const parsed = ProgressSchema.parse(progress);
  await writeFile(join(tutorDir(projectRoot), "progress.json"), `${JSON.stringify(parsed, null, 2)}\n`);
}

export async function writePackLock(projectRoot: string, packLock: PackLock): Promise<void> {
  await mkdir(tutorDir(projectRoot), { recursive: true });
  const parsed = PackLockSchema.parse(packLock);
  await writeFile(join(tutorDir(projectRoot), "pack.lock"), YAML.stringify(parsed));
}
```

Update `packages/tutor-core/src/index.ts`:

```ts
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
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/progress-store.test.ts src/__tests__/safe-copy.test.ts
pnpm build
```

Expected: PASS and build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/tutor-core
git commit -m "feat: add progress store and safe copy"
```

## Task 5: Installer Core

**Files:**
- Create: `packages/tutor-core/src/pack/installer.ts`
- Create: `packages/tutor-core/src/__tests__/installer.test.ts`
- Modify: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write failing installer tests**

`packages/tutor-core/src/__tests__/installer.test.ts`:

```ts
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { installTutorProject } from "../pack/installer.js";
import { loadTutorPack } from "../pack/loader.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("installTutorProject", () => {
  it("creates a new Java study project with step 01 artifacts", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-install-"));
    const packRoot = join(process.cwd(), "../../packs/jpa-tutor-pack");
    const pack = await loadTutorPack(packRoot);
    const projectRoot = join(workspace, "mini-jpa-study");

    await installTutorProject({
      pack,
      projectRoot,
      courseId: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });

    await expect(exists(join(projectRoot, "build.gradle"))).resolves.toBe(true);
    await expect(exists(join(projectRoot, ".tutor", "progress.json"))).resolves.toBe(true);
    await expect(exists(join(projectRoot, ".tutor", "pack.lock"))).resolves.toBe(true);
    await expect(exists(join(projectRoot, ".tutor", "steps", "step-01-entity-annotations", "requirements.md"))).resolves.toBe(true);
    await expect(exists(join(projectRoot, ".tutor", "steps", "step-01-entity-annotations", "tck-tests"))).resolves.toBe(true);
    await expect(exists(join(projectRoot, "src", "test", "java", "publictests", "step01", "EntityAnnotationSanityTest.java"))).resolves.toBe(true);

    const progress = JSON.parse(await readFile(join(projectRoot, ".tutor", "progress.json"), "utf8"));
    expect(progress).toMatchObject({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      currentStep: "step-01-entity-annotations",
      completedSteps: []
    });
  });

  it("refuses to install into an existing directory", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-install-conflict-"));
    const pack = await loadTutorPack(join(process.cwd(), "../../packs/jpa-tutor-pack"));
    await import("node:fs/promises").then((fs) => fs.mkdir(join(workspace, "mini-jpa-study")));

    await expect(installTutorProject({
      pack,
      projectRoot: join(workspace, "mini-jpa-study"),
      courseId: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    })).rejects.toThrow("Install target already exists");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/installer.test.ts
```

Expected: FAIL because `installer.js` does not exist.

- [ ] **Step 3: Implement installer**

`packages/tutor-core/src/pack/installer.ts`:

```ts
import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { StudyTutorError } from "../errors.js";
import { copyDirectoryWithoutOverwrite } from "../fs/copy.js";
import { writePackLock, writeProgress } from "../progress/progress-store.js";
import { LoadedTutorPack } from "./schema.js";

export interface InstallTutorProjectInput {
  pack: LoadedTutorPack;
  projectRoot: string;
  courseId: string;
  source: string;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function publicTestsTargetForStep(projectRoot: string, stepId: string): string {
  const stepNumber = stepId.match(/step-(\d+)/)?.[1] ?? stepId;
  return join(projectRoot, "src", "test", "java", "publictests", `step${stepNumber}`);
}

async function installStepArtifacts(pack: LoadedTutorPack, projectRoot: string, stepId: string): Promise<void> {
  const step = pack.stepById.get(stepId);
  if (!step) {
    throw new StudyTutorError(`Unknown step ${stepId}`);
  }

  await mkdir(join(projectRoot, ".tutor", "steps", stepId), { recursive: true });
  await copyDirectoryWithoutOverwrite(step.root, join(projectRoot, ".tutor", "steps", stepId));
  await copyDirectoryWithoutOverwrite(join(step.root, "public-tests"), publicTestsTargetForStep(projectRoot, stepId));
}

export async function installTutorProject(input: InstallTutorProjectInput): Promise<void> {
  if (await pathExists(input.projectRoot)) {
    throw new StudyTutorError("Install target already exists", [input.projectRoot]);
  }

  await mkdir(input.projectRoot, { recursive: true });
  await copyDirectoryWithoutOverwrite(join(input.pack.root, "templates", "gradle-project"), input.projectRoot);
  await installStepArtifacts(input.pack, input.projectRoot, input.pack.metadata.initialStep);
  await writeProgress(input.projectRoot, {
    pack: input.pack.metadata.id,
    version: input.pack.metadata.version,
    course: input.courseId,
    currentStep: input.pack.metadata.initialStep,
    completedSteps: []
  });
  await writePackLock(input.projectRoot, {
    pack: input.pack.metadata.id,
    version: input.pack.metadata.version,
    course: input.courseId,
    source: input.source
  });
}

export { installStepArtifacts };
```

Update `packages/tutor-core/src/index.ts`:

```ts
export const STUDY_TUTOR_CORE_VERSION = "0.1.0";
export { StudyTutorError } from "./errors.js";
export { copyDirectoryWithoutOverwrite } from "./fs/copy.js";
export { installTutorProject } from "./pack/installer.js";
export { loadTutorPack } from "./pack/loader.js";
export { readProgress, writePackLock, writeProgress } from "./progress/progress-store.js";
export type { InstallTutorProjectInput } from "./pack/installer.js";
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

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/installer.test.ts
pnpm build
```

Expected: PASS and build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/tutor-core
git commit -m "feat: install tutor project from bundled pack"
```

## Task 6: CLI Install And Status

**Files:**
- Create: `apps/cli/src/paths.ts`
- Create: `apps/cli/src/commands/install.ts`
- Create: `apps/cli/src/commands/status.ts`
- Modify: `apps/cli/src/index.ts`
- Create: `apps/cli/src/__tests__/status-output.test.ts`

- [ ] **Step 1: Write status output test**

`apps/cli/src/__tests__/status-output.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatStatus } from "../commands/status.js";

describe("formatStatus", () => {
  it("shows current state and next actions", () => {
    const output = formatStatus({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      courseTitle: "Mini Hibernate로 배우는 JPA",
      currentStepTitle: "Entity Annotation 만들기",
      currentStepId: "step-01-entity-annotations",
      completedCount: 0,
      totalCount: 3
    });

    expect(output).toContain("Pack: jpa-tutor-pack@0.1.0");
    expect(output).toContain("Current Step: 01 - Entity Annotation 만들기");
    expect(output).toContain(".tutor/steps/step-01-entity-annotations/requirements.md");
    expect(output).toContain("src/test/java/learner");
    expect(output).toContain("study-tutor next");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @study-tutor/cli test -- src/__tests__/status-output.test.ts
```

Expected: FAIL because `commands/status.js` does not exist.

- [ ] **Step 3: Implement CLI path helper**

`apps/cli/src/paths.ts`:

```ts
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function repoRootFromCliSource(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return join(dirname(currentFile), "..", "..", "..");
}

export function bundledPackRoot(packId: string): string {
  return join(repoRootFromCliSource(), "packs", packId);
}
```

- [ ] **Step 4: Implement install command**

`apps/cli/src/commands/install.ts`:

```ts
import { input, select } from "@inquirer/prompts";
import { resolve } from "node:path";
import { installTutorProject, loadTutorPack } from "@study-tutor/core";
import { bundledPackRoot } from "../paths.js";

export async function runInstallCommand(packId: string): Promise<void> {
  if (packId !== "jpa-tutor-pack") {
    throw new Error(`Unsupported pack: ${packId}`);
  }

  const pack = await loadTutorPack(bundledPackRoot(packId));
  console.log("JPA Tutor Pack을 설치합니다.\n");

  const directoryName = await input({
    message: "어디에 설치할까요?",
    default: "mini-jpa-study"
  });

  const courseId = await select<string>({
    message: "어떤 방식으로 학습할까요?",
    choices: [
      { name: "Mini Hibernate 구현", value: "mini-hibernate" },
      { name: "JPA 개념 중심 실습 (coming soon)", value: "jpa-concepts-practice", disabled: "coming soon" },
      { name: "Spring Data JPA 실무 패턴 (coming soon)", value: "spring-data-jpa-practice", disabled: "coming soon" },
      { name: "면접 대비 집중 코스 (coming soon)", value: "jpa-interview-focus", disabled: "coming soon" }
    ]
  });

  const projectRoot = resolve(process.cwd(), directoryName);
  await installTutorProject({
    pack,
    projectRoot,
    courseId,
    source: "bundled:packs/jpa-tutor-pack"
  });

  console.log("");
  console.log("학습 프로젝트가 생성되었습니다.");
  console.log(`경로: ${projectRoot}`);
  console.log("현재 Step: 01 - Entity Annotation 만들기");
  console.log("");
  console.log("다음 명령:");
  console.log(`  cd ${directoryName}`);
  console.log("  study-tutor status");
}
```

- [ ] **Step 5: Implement status command and formatter**

`apps/cli/src/commands/status.ts`:

```ts
import { loadTutorPack, readProgress } from "@study-tutor/core";
import { bundledPackRoot } from "../paths.js";

export interface StatusView {
  pack: string;
  version: string;
  courseTitle: string;
  currentStepTitle: string;
  currentStepId: string;
  completedCount: number;
  totalCount: number;
}

function stepNumber(stepId: string): string {
  return stepId.match(/step-(\d+)/)?.[1] ?? "?";
}

export function formatStatus(view: StatusView): string {
  return [
    `Pack: ${view.pack}@${view.version}`,
    `Course: ${view.courseTitle}`,
    `Current Step: ${stepNumber(view.currentStepId)} - ${view.currentStepTitle}`,
    `Completed Steps: ${view.completedCount}/${view.totalCount}`,
    "",
    "Next action:",
    `- .tutor/steps/${view.currentStepId}/requirements.md를 읽으세요.`,
    "- src/test/java/learner 아래에 직접 테스트를 작성하세요.",
    "- 구현 후 study-tutor test를 실행하세요.",
    "- 준비되면 study-tutor next를 실행하세요."
  ].join("\n");
}

export async function runStatusCommand(projectRoot = process.cwd()): Promise<void> {
  const progress = await readProgress(projectRoot);
  const pack = await loadTutorPack(bundledPackRoot(progress.pack));
  const course = pack.activeCourses.find((candidate) => candidate.id === progress.course);
  const step = pack.stepById.get(progress.currentStep);

  if (!course || !step) {
    throw new Error("progress.json references a course or step that does not exist in the bundled pack");
  }

  console.log(formatStatus({
    pack: progress.pack,
    version: progress.version,
    courseTitle: course.title,
    currentStepTitle: step.title,
    currentStepId: step.id,
    completedCount: progress.completedSteps.length,
    totalCount: course.steps?.length ?? pack.steps.length
  }));
}
```

- [ ] **Step 6: Wire commands**

`apps/cli/src/index.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { STUDY_TUTOR_CORE_VERSION } from "@study-tutor/core";
import { runInstallCommand } from "./commands/install.js";
import { runStatusCommand } from "./commands/status.js";

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

program
  .command("status")
  .description("Show current study progress and next actions")
  .action(() => runStatusCommand());

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
```

- [ ] **Step 7: Run tests and manual CLI help**

Run:

```bash
pnpm --filter @study-tutor/cli test -- src/__tests__/status-output.test.ts
pnpm build
pnpm cli -- --help
```

Expected:

```text
Usage: study-tutor [options] [command]
Commands:
  install <pack-id>
  status
```

- [ ] **Step 8: Commit**

```bash
git add apps/cli
git commit -m "feat: add install and status commands"
```

## Task 7: Gradle Test Runner And Test Command

**Files:**
- Create: `packages/tutor-core/src/test/gradle-runner.ts`
- Create: `packages/tutor-core/src/__tests__/gradle-runner.test.ts`
- Create: `apps/cli/src/commands/test.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write failing Gradle runner tests**

`packages/tutor-core/src/__tests__/gradle-runner.test.ts`:

```ts
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runGradleTest } from "../test/gradle-runner.js";

async function createFakeGradlew(exitCode: number, output: string) {
  const root = await mkdtemp(join(tmpdir(), "study-tutor-gradle-"));
  const gradlew = join(root, "gradlew");
  await writeFile(gradlew, `#!/usr/bin/env bash\necho "${output}"\nexit ${exitCode}\n`);
  await chmod(gradlew, 0o755);
  return root;
}

describe("runGradleTest", () => {
  it("returns success when gradlew test passes", async () => {
    const root = await createFakeGradlew(0, "BUILD SUCCESSFUL");

    const result = await runGradleTest(root);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("BUILD SUCCESSFUL");
  });

  it("returns failure output when gradlew test fails", async () => {
    const root = await createFakeGradlew(1, "BUILD FAILED");

    const result = await runGradleTest(root);

    expect(result.ok).toBe(false);
    expect(result.output).toContain("BUILD FAILED");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/gradle-runner.test.ts
```

Expected: FAIL because `gradle-runner.js` does not exist.

- [ ] **Step 3: Implement Gradle runner**

`packages/tutor-core/src/test/gradle-runner.ts`:

```ts
import { execa } from "execa";

export interface GradleRunResult {
  ok: boolean;
  output: string;
}

export async function runGradleTest(projectRoot: string, args: string[] = []): Promise<GradleRunResult> {
  try {
    const result = await execa("./gradlew", ["test", ...args], {
      cwd: projectRoot,
      all: true,
      reject: false
    });
    return {
      ok: result.exitCode === 0,
      output: result.all ?? ""
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, output: message };
  }
}
```

Update `packages/tutor-core/src/index.ts`:

```ts
export const STUDY_TUTOR_CORE_VERSION = "0.1.0";
export { StudyTutorError } from "./errors.js";
export { copyDirectoryWithoutOverwrite } from "./fs/copy.js";
export { installTutorProject } from "./pack/installer.js";
export { loadTutorPack } from "./pack/loader.js";
export { readProgress, writePackLock, writeProgress } from "./progress/progress-store.js";
export { runGradleTest } from "./test/gradle-runner.js";
export type { GradleRunResult } from "./test/gradle-runner.js";
export type { InstallTutorProjectInput } from "./pack/installer.js";
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

- [ ] **Step 4: Implement CLI test command**

`apps/cli/src/commands/test.ts`:

```ts
import { readProgress, runGradleTest } from "@study-tutor/core";

export async function runTestCommand(projectRoot = process.cwd()): Promise<void> {
  await readProgress(projectRoot);
  const result = await runGradleTest(projectRoot);
  process.stdout.write(result.output);
  if (!result.ok) {
    throw new Error("study-tutor test failed");
  }
}
```

Update `apps/cli/src/index.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { STUDY_TUTOR_CORE_VERSION } from "@study-tutor/core";
import { runInstallCommand } from "./commands/install.js";
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

program
  .command("status")
  .description("Show current study progress and next actions")
  .action(() => runStatusCommand());

program
  .command("test")
  .description("Run learner tests and public sanity tests")
  .action(() => runTestCommand());

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/gradle-runner.test.ts
pnpm build
pnpm cli -- --help
```

Expected: PASS, build succeeds, and help includes `test`.

- [ ] **Step 6: Commit**

```bash
git add packages/tutor-core apps/cli
git commit -m "feat: run project tests from cli"
```

## Task 8: TCK Runner

**Files:**
- Create: `packages/tutor-core/src/test/tck-runner.ts`
- Create: `packages/tutor-core/src/__tests__/tck-runner.test.ts`
- Modify: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write failing TCK runner tests**

`packages/tutor-core/src/__tests__/tck-runner.test.ts`:

```ts
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCurrentStepTck } from "../test/tck-runner.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("runCurrentStepTck", () => {
  it("copies TCK files, runs filtered Gradle tests, and cleans copied files", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-tck-"));
    await mkdir(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01"), { recursive: true });
    await mkdir(join(projectRoot, "src", "test", "java"), { recursive: true });
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01", "SampleTckTest.java"), "package tutortck.step01; class SampleTckTest {}");
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck.yaml"), [
      "edgeCases:",
      "  sample:",
      "    testClass: tutortck.step01.SampleTckTest",
      "    title: Sample edge",
      "    whyImportant: Sample reason",
      "    hint: Sample hint"
    ].join("\n"));

    const seenArgs: string[][] = [];
    const result = await runCurrentStepTck({
      projectRoot,
      stepId: "step-01",
      runGradle: async (_root, args) => {
        seenArgs.push(args);
        return { ok: true, output: "BUILD SUCCESSFUL" };
      }
    });

    expect(result.ok).toBe(true);
    expect(seenArgs[0]).toEqual(["--tests", "tutortck.step01.*"]);
    await expect(exists(join(projectRoot, "src", "test", "java", "tutortck"))).resolves.toBe(false);
  });

  it("maps failed TCK output to tck.yaml edge case messages", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-tck-fail-"));
    await mkdir(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01"), { recursive: true });
    await mkdir(join(projectRoot, "src", "test", "java"), { recursive: true });
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck-tests", "tutortck", "step01", "SampleTckTest.java"), "package tutortck.step01; class SampleTckTest {}");
    await writeFile(join(projectRoot, ".tutor", "steps", "step-01", "tck.yaml"), [
      "edgeCases:",
      "  sample:",
      "    testClass: tutortck.step01.SampleTckTest",
      "    title: Sample edge",
      "    whyImportant: Sample reason",
      "    hint: Sample hint"
    ].join("\n"));

    const result = await runCurrentStepTck({
      projectRoot,
      stepId: "step-01",
      runGradle: async () => ({ ok: false, output: "tutortck.step01.SampleTckTest > sample failed" })
    });

    expect(result.ok).toBe(false);
    expect(result.failedEdgeCases).toEqual([{
      id: "sample",
      testClass: "tutortck.step01.SampleTckTest",
      title: "Sample edge",
      whyImportant: "Sample reason",
      hint: "Sample hint"
    }]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/tck-runner.test.ts
```

Expected: FAIL because `tck-runner.js` does not exist.

- [ ] **Step 3: Implement TCK runner**

`packages/tutor-core/src/test/tck-runner.ts`:

```ts
import { rm } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { readFile } from "node:fs/promises";
import { copyDirectoryWithoutOverwrite } from "../fs/copy.js";
import { TckEdgeCase, TckSchema } from "../pack/schema.js";
import { GradleRunResult, runGradleTest } from "./gradle-runner.js";

export interface TckRunInput {
  projectRoot: string;
  stepId: string;
  runGradle?: (projectRoot: string, args: string[]) => Promise<GradleRunResult>;
}

export interface TckRunResult {
  ok: boolean;
  output: string;
  failedEdgeCases: TckEdgeCase[];
}

function stepPackage(stepId: string): string {
  const number = stepId.match(/step-(\d+)/)?.[1] ?? stepId;
  return `tutortck.step${number}`;
}

async function readTckMetadata(projectRoot: string, stepId: string): Promise<TckEdgeCase[]> {
  const file = join(projectRoot, ".tutor", "steps", stepId, "tck.yaml");
  const parsed = TckSchema.parse(YAML.parse(await readFile(file, "utf8")));
  return Object.entries(parsed.edgeCases).map(([id, value]) => ({ id, ...value }));
}

function failedCasesFromOutput(edgeCases: TckEdgeCase[], output: string): TckEdgeCase[] {
  return edgeCases.filter((edgeCase) => output.includes(edgeCase.testClass));
}

export async function runCurrentStepTck(input: TckRunInput): Promise<TckRunResult> {
  const packageName = stepPackage(input.stepId);
  const source = join(input.projectRoot, ".tutor", "steps", input.stepId, "tck-tests");
  const target = join(input.projectRoot, "src", "test", "java", "tutortck");
  const edgeCases = await readTckMetadata(input.projectRoot, input.stepId);
  const gradle = input.runGradle ?? runGradleTest;

  await rm(target, { recursive: true, force: true });
  try {
    await copyDirectoryWithoutOverwrite(source, join(input.projectRoot, "src", "test", "java"));
    const result = await gradle(input.projectRoot, ["--tests", `${packageName}.*`]);
    return {
      ok: result.ok,
      output: result.output,
      failedEdgeCases: result.ok ? [] : failedCasesFromOutput(edgeCases, result.output)
    };
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}
```

Update `packages/tutor-core/src/index.ts`:

```ts
export const STUDY_TUTOR_CORE_VERSION = "0.1.0";
export { StudyTutorError } from "./errors.js";
export { copyDirectoryWithoutOverwrite } from "./fs/copy.js";
export { installTutorProject } from "./pack/installer.js";
export { loadTutorPack } from "./pack/loader.js";
export { readProgress, writePackLock, writeProgress } from "./progress/progress-store.js";
export { runGradleTest } from "./test/gradle-runner.js";
export { runCurrentStepTck } from "./test/tck-runner.js";
export type { GradleRunResult } from "./test/gradle-runner.js";
export type { TckRunInput, TckRunResult } from "./test/tck-runner.js";
export type { InstallTutorProjectInput } from "./pack/installer.js";
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

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/tck-runner.test.ts
pnpm build
```

Expected: PASS and build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/tutor-core
git commit -m "feat: run step tck checks"
```

## Task 9: Step Service And Next Command

**Files:**
- Create: `packages/tutor-core/src/steps/step-service.ts`
- Create: `packages/tutor-core/src/__tests__/step-service.test.ts`
- Create: `apps/cli/src/commands/next.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `packages/tutor-core/src/index.ts`

- [ ] **Step 1: Write failing step service tests**

`packages/tutor-core/src/__tests__/step-service.test.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { advanceToNextStep } from "../steps/step-service.js";
import { loadTutorPack } from "../pack/loader.js";
import { writeProgress } from "../progress/progress-store.js";

async function createProjectAtStep(stepId = "step-01-entity-annotations") {
  const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-next-"));
  await mkdir(join(projectRoot, ".tutor", "steps", stepId), { recursive: true });
  await mkdir(join(projectRoot, "src", "test", "java", "learner"), { recursive: true });
  await writeProgress(projectRoot, {
    pack: "jpa-tutor-pack",
    version: "0.1.0",
    course: "mini-hibernate",
    currentStep: stepId,
    completedSteps: []
  });
  return projectRoot;
}

describe("advanceToNextStep", () => {
  it("fails when no learner test exists", async () => {
    const projectRoot = await createProjectAtStep();
    const pack = await loadTutorPack(join(process.cwd(), "../../packs/jpa-tutor-pack"));

    await expect(advanceToNextStep({
      projectRoot,
      pack,
      runGradle: async () => ({ ok: true, output: "BUILD SUCCESSFUL" }),
      runTck: async () => ({ ok: true, output: "BUILD SUCCESSFUL", failedEdgeCases: [] })
    })).rejects.toThrow("Write at least one learner test");
  });

  it("runs tests and TCK, installs next step, and updates progress", async () => {
    const projectRoot = await createProjectAtStep();
    await writeFile(join(projectRoot, "src", "test", "java", "learner", "EntityAnnotationTest.java"), "class EntityAnnotationTest {}");
    const pack = await loadTutorPack(join(process.cwd(), "../../packs/jpa-tutor-pack"));
    const calls: string[] = [];

    const result = await advanceToNextStep({
      projectRoot,
      pack,
      runGradle: async () => {
        calls.push("gradle");
        return { ok: true, output: "BUILD SUCCESSFUL" };
      },
      runTck: async () => {
        calls.push("tck");
        return { ok: true, output: "BUILD SUCCESSFUL", failedEdgeCases: [] };
      }
    });

    expect(calls).toEqual(["gradle", "tck"]);
    expect(result.nextStep?.id).toBe("step-02-entity-metadata");
    const progress = JSON.parse(await readFile(join(projectRoot, ".tutor", "progress.json"), "utf8"));
    expect(progress.completedSteps).toEqual(["step-01-entity-annotations"]);
    expect(progress.currentStep).toBe("step-02-entity-metadata");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/step-service.test.ts
```

Expected: FAIL because `step-service.js` does not exist.

- [ ] **Step 3: Implement step service**

`packages/tutor-core/src/steps/step-service.ts`:

```ts
import fg from "fast-glob";
import { StudyTutorError } from "../errors.js";
import { installStepArtifacts } from "../pack/installer.js";
import { LoadedStep, LoadedTutorPack, TckEdgeCase } from "../pack/schema.js";
import { readProgress, writeProgress } from "../progress/progress-store.js";
import { GradleRunResult, runGradleTest } from "../test/gradle-runner.js";
import { runCurrentStepTck, TckRunResult } from "../test/tck-runner.js";

export interface AdvanceInput {
  projectRoot: string;
  pack: LoadedTutorPack;
  runGradle?: (projectRoot: string) => Promise<GradleRunResult>;
  runTck?: (input: { projectRoot: string; stepId: string }) => Promise<TckRunResult>;
}

export interface AdvanceResult {
  completedStep: LoadedStep;
  nextStep: LoadedStep | null;
  tckFailures: TckEdgeCase[];
}

async function assertLearnerTestExists(projectRoot: string): Promise<void> {
  const files = await fg("src/test/java/learner/**/*Test.java", {
    cwd: projectRoot,
    onlyFiles: true
  });
  if (files.length === 0) {
    throw new StudyTutorError("Write at least one learner test before running study-tutor next.", [
      "Expected at least one file matching src/test/java/learner/**/*Test.java"
    ]);
  }
}

function nextStepAfter(pack: LoadedTutorPack, currentStepId: string): LoadedStep | null {
  const index = pack.steps.findIndex((step) => step.id === currentStepId);
  if (index < 0) {
    throw new StudyTutorError(`Unknown current step ${currentStepId}`);
  }
  return pack.steps[index + 1] ?? null;
}

export async function advanceToNextStep(input: AdvanceInput): Promise<AdvanceResult> {
  const progress = await readProgress(input.projectRoot);
  const currentStep = packStepOrThrow(input.pack, progress.currentStep);
  await assertLearnerTestExists(input.projectRoot);

  const gradleResult = await (input.runGradle ?? runGradleTest)(input.projectRoot);
  if (!gradleResult.ok) {
    throw new StudyTutorError("Gradle tests failed", [gradleResult.output]);
  }

  const tckResult = await (input.runTck ?? ((args) => runCurrentStepTck(args)))({
    projectRoot: input.projectRoot,
    stepId: progress.currentStep
  });
  if (!tckResult.ok) {
    throw new StudyTutorError("TCK checks failed", [
      tckResult.output,
      ...tckResult.failedEdgeCases.map((edgeCase) => `${edgeCase.title}\n왜 중요한가: ${edgeCase.whyImportant}\n힌트: ${edgeCase.hint}`)
    ]);
  }

  const nextStep = nextStepAfter(input.pack, progress.currentStep);
  const completedSteps = progress.completedSteps.includes(progress.currentStep)
    ? progress.completedSteps
    : [...progress.completedSteps, progress.currentStep];

  if (nextStep) {
    await installStepArtifacts(input.pack, input.projectRoot, nextStep.id);
  }

  await writeProgress(input.projectRoot, {
    ...progress,
    currentStep: nextStep?.id ?? progress.currentStep,
    completedSteps
  });

  return { completedStep: currentStep, nextStep, tckFailures: [] };
}

function packStepOrThrow(pack: LoadedTutorPack, stepId: string): LoadedStep {
  const step = pack.stepById.get(stepId);
  if (!step) {
    throw new StudyTutorError(`Unknown current step ${stepId}`);
  }
  return step;
}
```

Update `packages/tutor-core/src/index.ts`:

```ts
export const STUDY_TUTOR_CORE_VERSION = "0.1.0";
export { StudyTutorError } from "./errors.js";
export { copyDirectoryWithoutOverwrite } from "./fs/copy.js";
export { installTutorProject } from "./pack/installer.js";
export { loadTutorPack } from "./pack/loader.js";
export { readProgress, writePackLock, writeProgress } from "./progress/progress-store.js";
export { advanceToNextStep } from "./steps/step-service.js";
export { runGradleTest } from "./test/gradle-runner.js";
export { runCurrentStepTck } from "./test/tck-runner.js";
export type { AdvanceInput, AdvanceResult } from "./steps/step-service.js";
export type { GradleRunResult } from "./test/gradle-runner.js";
export type { TckRunInput, TckRunResult } from "./test/tck-runner.js";
export type { InstallTutorProjectInput } from "./pack/installer.js";
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

- [ ] **Step 4: Implement next command**

`apps/cli/src/commands/next.ts`:

```ts
import { advanceToNextStep, loadTutorPack, readProgress, StudyTutorError } from "@study-tutor/core";
import { bundledPackRoot } from "../paths.js";

export async function runNextCommand(projectRoot = process.cwd()): Promise<void> {
  const progress = await readProgress(projectRoot);
  const pack = await loadTutorPack(bundledPackRoot(progress.pack));

  try {
    const result = await advanceToNextStep({ projectRoot, pack });
    console.log(`Step completed: ${result.completedStep.title}`);
    if (result.nextStep) {
      console.log(`Next step created: ${result.nextStep.title}`);
      console.log(`Read: .tutor/steps/${result.nextStep.id}/requirements.md`);
    } else {
      console.log("모든 MVP step을 완료했습니다.");
    }
  } catch (error) {
    if (error instanceof StudyTutorError && error.message === "TCK checks failed") {
      console.error("Edge-case TCK failed.");
      for (const detail of error.details) {
        console.error("");
        console.error(detail);
      }
      throw new Error("study-tutor next failed");
    }
    throw error;
  }
}
```

Update `apps/cli/src/index.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { STUDY_TUTOR_CORE_VERSION } from "@study-tutor/core";
import { runInstallCommand } from "./commands/install.js";
import { runNextCommand } from "./commands/next.js";
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

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/step-service.test.ts
pnpm build
pnpm cli -- --help
```

Expected: PASS, build succeeds, and help includes `next`.

- [ ] **Step 6: Commit**

```bash
git add packages/tutor-core apps/cli
git commit -m "feat: advance tutor steps"
```

## Task 10: E2E Smoke Test And Example Fixture

**Files:**
- Create: `examples/fixtures/step01-solution/src/main/java/io/tutor/minijpa/Entity.java`
- Create: `examples/fixtures/step01-solution/src/main/java/io/tutor/minijpa/Table.java`
- Create: `examples/fixtures/step01-solution/src/main/java/io/tutor/minijpa/Id.java`
- Create: `examples/fixtures/step01-solution/src/main/java/io/tutor/minijpa/Column.java`
- Create: `examples/fixtures/step01-solution/src/test/java/learner/EntityAnnotationLearnerTest.java`
- Create: `packages/tutor-core/src/__tests__/e2e-smoke.test.ts`

- [ ] **Step 1: Create step 01 solution fixture**

`examples/fixtures/step01-solution/src/main/java/io/tutor/minijpa/Entity.java`:

```java
package io.tutor.minijpa;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Entity {
}
```

`examples/fixtures/step01-solution/src/main/java/io/tutor/minijpa/Table.java`:

```java
package io.tutor.minijpa;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Table {
    String name();
}
```

`examples/fixtures/step01-solution/src/main/java/io/tutor/minijpa/Id.java`:

```java
package io.tutor.minijpa;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Id {
}
```

`examples/fixtures/step01-solution/src/main/java/io/tutor/minijpa/Column.java`:

```java
package io.tutor.minijpa;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Column {
    String name();
}
```

`examples/fixtures/step01-solution/src/test/java/learner/EntityAnnotationLearnerTest.java`:

```java
package learner;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EntityAnnotationLearnerTest {
    @Entity
    @Table(name = "members")
    static class Member {
        @Id
        @Column(name = "id")
        private Long id;
    }

    @Test
    void readsEntityMappingAnnotationsAtRuntime() throws Exception {
        assertThat(Member.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Member.class.getAnnotation(Table.class).name()).isEqualTo("members");
        assertThat(Member.class.getDeclaredField("id").isAnnotationPresent(Id.class)).isTrue();
        assertThat(Member.class.getDeclaredField("id").getAnnotation(Column.class).name()).isEqualTo("id");
    }
}
```

- [ ] **Step 2: Write E2E smoke test**

`packages/tutor-core/src/__tests__/e2e-smoke.test.ts`:

```ts
import { cp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { installTutorProject } from "../pack/installer.js";
import { loadTutorPack } from "../pack/loader.js";
import { advanceToNextStep } from "../steps/step-service.js";
import { runGradleTest } from "../test/gradle-runner.js";

describe("Phase 1 smoke flow", () => {
  it("installs step 01, runs tests, and advances to step 02", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "study-tutor-e2e-"));
    const projectRoot = join(workspace, "mini-jpa-study");
    const pack = await loadTutorPack(join(process.cwd(), "../../packs/jpa-tutor-pack"));

    await installTutorProject({
      pack,
      projectRoot,
      courseId: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });
    await cp(join(process.cwd(), "../../examples/fixtures/step01-solution", "src"), join(projectRoot, "src"), { recursive: true });

    const testResult = await runGradleTest(projectRoot);
    expect(testResult.ok, testResult.output).toBe(true);

    const nextResult = await advanceToNextStep({ projectRoot, pack });
    expect(nextResult.nextStep?.id).toBe("step-02-entity-metadata");

    const progress = JSON.parse(await readFile(join(projectRoot, ".tutor", "progress.json"), "utf8"));
    expect(progress.currentStep).toBe("step-02-entity-metadata");
    expect(progress.completedSteps).toEqual(["step-01-entity-annotations"]);
  }, 120_000);
});
```

- [ ] **Step 3: Run smoke test**

Run:

```bash
pnpm --filter @study-tutor/core test -- src/__tests__/e2e-smoke.test.ts
```

Expected: PASS. First run may download Gradle and dependencies.

- [ ] **Step 4: Commit**

```bash
git add examples packages/tutor-core/src/__tests__/e2e-smoke.test.ts
git commit -m "test: cover tutor mvp smoke flow"
```

## Task 11: README And Final Verification

**Files:**
- Create or modify: `README.md`

- [ ] **Step 1: Write README**

`README.md`:

```md
# Study Tutor

Study Tutor는 프레임워크 내부를 직접 구현하며 배우는 CLI 기반 학습 런타임입니다.

핵심 문장:

> Learn by evolving your own codebase.

학습자는 요구사항을 읽고, 직접 테스트를 작성하고, 구현하고, public sanity test와 edge-case TCK를 통과하면서 개념을 익힙니다.

## MVP 범위

- `study-tutor install jpa-tutor-pack`
- `study-tutor status`
- `study-tutor test`
- `study-tutor next`
- 로컬 bundled `jpa-tutor-pack`
- Mini Hibernate 코스 step 1~3
- learner test 파일 작성 강제
- public sanity test와 public edge-case TCK

MVP에서 지원하지 않는 것:

- 원격 pack registry
- pack marketplace
- GitHub App 리뷰
- hidden TCK server
- 웹 UI
- DB 또는 로그인

## 개발 환경

- Node.js 20 이상
- pnpm 9 이상
- Java 21
- Gradle wrapper는 생성되는 학습 프로젝트에 포함됩니다.

## 설치

```bash
pnpm install
pnpm build
```

## CLI 실행

```bash
pnpm cli -- install jpa-tutor-pack
```

생성된 학습 프로젝트 안에서:

```bash
study-tutor status
study-tutor test
study-tutor next
```

로컬 개발 중에는 다음처럼 실행할 수도 있습니다.

```bash
pnpm --filter @study-tutor/cli dev -- status
```

## 학습 흐름

1. `.tutor/steps/<current-step>/requirements.md`를 읽습니다.
2. `src/test/java/learner` 아래에 직접 테스트를 작성합니다.
3. `src/main/java/io/tutor/minijpa` 아래에 구현합니다.
4. `study-tutor test`로 learner test와 public sanity test를 실행합니다.
5. `study-tutor next`로 edge-case TCK를 실행하고 다음 step으로 이동합니다.

## 프로젝트 구조

```text
apps/cli                study-tutor CLI
packages/tutor-core     pack loading, install, progress, test, next runtime
packs/jpa-tutor-pack    bundled JPA tutor pack
examples/fixtures       smoke test fixtures
```
```

- [ ] **Step 2: Run full verification**

Run:

```bash
pnpm install
pnpm build
pnpm test
pnpm cli -- --help
```

Expected:

```text
pnpm build exits 0
pnpm test exits 0
study-tutor help includes install, status, test, next
```

- [ ] **Step 3: Inspect Git state**

Run:

```bash
git status --short
```

Expected: only intentional README changes and any generated lockfile changes remain unstaged.

- [ ] **Step 4: Commit**

```bash
git add README.md pnpm-lock.yaml
git commit -m "docs: document study tutor mvp"
```

## Final Self-Review Checklist

- Spec coverage: Tasks 1-2 cover TypeScript workspace and pack schema; Tasks 3-5 cover bundled pack and install; Tasks 6-9 cover CLI commands, progress, test, next, and TCK; Task 10 covers E2E smoke testing; Task 11 covers README.
- Placeholder scan: The plan contains no incomplete sections, no undefined command names, and no generic edge-case instruction without a concrete file or test.
- Type consistency: `LoadedTutorPack`, `LoadedStep`, `Progress`, `GradleRunResult`, and `TckRunResult` are defined before use and exported through `packages/tutor-core/src/index.ts`.
- Scope check: The plan implements only the approved Phase 1 MVP and does not add remote pack registry, GitHub App, web UI, database, marketplace, or hidden TCK server.
