import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadTutorPack } from "../pack/loader.js";

interface StepFixture {
  directory?: string;
  id: string;
  order: number;
  title?: string;
}

interface PackFixtureOptions {
  initialStep?: string;
  curriculumStepIds?: string[];
  steps?: StepFixture[];
}

async function createPackFixture(options: PackFixtureOptions = {}) {
  const {
    initialStep = "step-01",
    curriculumStepIds = ["step-01"],
    steps = [{ id: "step-01", order: 1, title: "Entity Annotation 만들기" }]
  } = options;
  const root = await mkdtemp(join(tmpdir(), "study-tutor-pack-"));
  await writeFile(join(root, "pack.yaml"), [
    "id: jpa-tutor-pack",
    "name: JPA Tutor Pack",
    "version: 0.1.0",
    "language: java",
    "runtime:",
    "  java: \"21\"",
    "  buildTool: gradle",
    `initialStep: ${initialStep}`
  ].join("\n"));
  await writeFile(join(root, "curriculum.yaml"), [
    "courses:",
    "  - id: mini-hibernate",
    "    title: Mini Hibernate로 배우는 JPA",
    "    status: active",
    "    steps:",
    ...curriculumStepIds.map((stepId) => `      - ${stepId}`),
    "  - id: jpa-concepts-practice",
    "    title: JPA 개념 중심 실습",
    "    status: coming-soon"
  ].join("\n"));
  for (const step of steps) {
    const stepRoot = join(root, "steps", step.directory ?? step.id);
    const edgeCaseId = step.id === "step-01" ? "annotation-runtime-retention" : `${step.id}-edge-case`;

    await mkdir(stepRoot, { recursive: true });
    await writeFile(join(stepRoot, "step.yaml"), [
      `id: ${step.id}`,
      `order: ${step.order}`,
      `title: ${step.title ?? `Step ${step.id}`}`
    ].join("\n"));
    await writeFile(join(stepRoot, "tck.yaml"), [
      "edgeCases:",
      `  ${edgeCaseId}:`,
      "    testClass: tutortck.step01.EntityAnnotationRetentionTckTest",
      "    title: 런타임 Retention",
      "    whyImportant: Reflection으로 annotation을 읽으려면 RUNTIME retention이 필요합니다.",
      "    hint: RetentionPolicy.RUNTIME을 사용하세요."
    ].join("\n"));
  }
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

  it("sorts active steps by order metadata", async () => {
    const root = await createPackFixture({
      curriculumStepIds: ["step-02", "step-01"],
      steps: [
        { id: "step-01", order: 1 },
        { id: "step-02", order: 2 }
      ]
    });

    const pack = await loadTutorPack(root);

    expect(pack.steps.map((step) => step.id)).toEqual(["step-01", "step-02"]);
  });

  it("fails when step yaml id does not match the curriculum step id", async () => {
    const root = await createPackFixture({
      steps: [
        { directory: "step-01", id: "step-02", order: 1 }
      ]
    });

    await expect(loadTutorPack(root)).rejects.toThrow("Step file id step-02 does not match curriculum step id step-01");
  });

  it("fails when loaded steps have duplicate orders", async () => {
    const root = await createPackFixture({
      curriculumStepIds: ["step-01", "step-02"],
      steps: [
        { id: "step-01", order: 1 },
        { id: "step-02", order: 1 }
      ]
    });

    await expect(loadTutorPack(root)).rejects.toThrow("Duplicate step order 1");
  });

  it("fails when active curriculum contains duplicate step ids", async () => {
    const root = await createPackFixture({
      curriculumStepIds: ["step-01", "step-01"]
    });

    await expect(loadTutorPack(root)).rejects.toThrow("Duplicate step id step-01");
  });

  it("rejects path-like step ids before loading files from disk", async () => {
    const root = await createPackFixture({
      curriculumStepIds: ["../escape", "step-01"]
    });

    await expect(loadTutorPack(root)).rejects.toMatchObject({
      message: expect.stringContaining("Invalid"),
      details: expect.arrayContaining([expect.stringContaining("courses.0.steps.0")])
    });
  });
});
