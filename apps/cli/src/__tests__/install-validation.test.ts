import { describe, expect, it } from "vitest";
import { formatInstallSuccess, validateInstallDirectoryName } from "../commands/install.js";

describe("validateInstallDirectoryName", () => {
  it("accepts a simple directory name", () => {
    expect(validateInstallDirectoryName("mini-jpa-study")).toBe(true);
  });

  it("rejects empty or whitespace-only names", () => {
    expect(validateInstallDirectoryName("")).toEqual(expect.any(String));
    expect(validateInstallDirectoryName("   ")).toEqual(expect.any(String));
  });

  it("rejects absolute paths", () => {
    expect(validateInstallDirectoryName("/tmp/mini-jpa-study")).toEqual(expect.any(String));
  });

  it("rejects path traversal segments", () => {
    expect(validateInstallDirectoryName("..")).toEqual(expect.any(String));
    expect(validateInstallDirectoryName("../mini-jpa-study")).toEqual(expect.any(String));
    expect(validateInstallDirectoryName("mini-jpa-study/../other")).toEqual(expect.any(String));
  });

  it("rejects path separators", () => {
    expect(validateInstallDirectoryName("parent/child")).toEqual(expect.any(String));
    expect(validateInstallDirectoryName("parent\\child")).toEqual(expect.any(String));
  });
});

describe("formatInstallSuccess", () => {
  it("guides users without assuming study-tutor is on PATH", () => {
    const output = formatInstallSuccess({
      directoryName: "mini-jpa-study",
      projectRoot: "/workspace/mini-jpa-study"
    });

    expect(output).toContain("학습 프로젝트가 생성되었습니다.");
    expect(output).toContain("경로: /workspace/mini-jpa-study");
    expect(output).toContain("cd mini-jpa-study");
    expect(output).toContain("현재 사용 중인 CLI 실행 방식으로 status를 실행하세요.");
    expect(output).not.toContain("study-tutor status");
  });
});
