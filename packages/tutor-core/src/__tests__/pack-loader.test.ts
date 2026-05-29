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
