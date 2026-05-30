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
    expect(output).toContain("현재 사용 중인 CLI 실행 방식으로 test를 실행하세요.");
    expect(output).toContain("현재 사용 중인 CLI 실행 방식으로 next를 실행하세요.");
    expect(output).not.toContain("study-tutor test");
    expect(output).not.toContain("study-tutor next");
  });

  it("shows completion instead of next actions when all steps are complete", () => {
    const completedView = {
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      courseTitle: "Mini Hibernate로 배우는 JPA",
      currentStepTitle: "Select SQL 생성하기",
      currentStepId: "step-03-select-sql-generation",
      completedCount: 3,
      totalCount: 3,
      isComplete: true
    };

    const output = formatStatus(completedView);

    expect(output).toContain("Current Step: 03 - Select SQL 생성하기");
    expect(output).toContain("모든 MVP step을 완료했습니다.");
    expect(output).not.toContain("Next action:");
    expect(output).not.toContain("requirements.md");
    expect(output).not.toContain("src/test/java/learner");
    expect(output).not.toContain("현재 사용 중인 CLI 실행 방식으로 next를 실행하세요.");
  });
});
