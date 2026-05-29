import { describe, expect, it } from "vitest";
import { validateInstallDirectoryName } from "../commands/install.js";

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
