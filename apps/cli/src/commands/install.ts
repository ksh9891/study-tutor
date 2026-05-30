import { input, select } from "@inquirer/prompts";
import { isAbsolute, resolve } from "node:path";
import {
  installTutorProject,
  loadTutorPack,
  resolveRegistryPack,
  resolveRegistryUrl,
  StudyTutorError
} from "@study-tutor/core";
import { bundledPackRoot } from "../paths.js";
import type { InstallTutorProjectInput, LoadedTutorPack } from "@study-tutor/core";

function normalizeInstallDirectoryName(value: string): string {
  return value.trim();
}

export function validateInstallDirectoryName(value: string): true | string {
  const trimmed = normalizeInstallDirectoryName(value);
  if (trimmed.length === 0) {
    return "디렉터리 이름을 입력하세요.";
  }
  if (isAbsolute(trimmed)) {
    return "상대 디렉터리 이름만 입력하세요.";
  }

  const pathSegments = trimmed.split(/[\\/]+/);
  if (pathSegments.includes("..")) {
    return ".. 경로 세그먼트는 사용할 수 없습니다.";
  }
  if (pathSegments.length > 1) {
    return "새로 만들 단일 디렉터리 이름만 입력하세요.";
  }

  return true;
}

export interface InstallSuccessView {
  directoryName: string;
  projectRoot: string;
}

export interface InstallCommandOptions {
  registry?: string;
  registryUrl?: string;
}

interface ResolvedInstallPack {
  pack: LoadedTutorPack;
  source: InstallTutorProjectInput["source"];
  snapshotSourceRoot?: string;
  cleanup?: () => Promise<void> | void;
}

export function formatInstallSuccess(view: InstallSuccessView): string {
  return [
    "",
    "학습 프로젝트가 생성되었습니다.",
    `경로: ${view.projectRoot}`,
    "현재 Step: 01 - Entity Annotation 만들기",
    "",
    "다음 명령:",
    `  cd ${view.directoryName}`,
    "  현재 사용 중인 CLI 실행 방식으로 status를 실행하세요."
  ].join("\n");
}

function formatStudyTutorError(error: StudyTutorError): Error {
  const details = error.details.map((detail) => `  - ${detail}`).join("\n");
  return new Error(details ? `${error.message}\n${details}` : error.message);
}

async function withStudyTutorErrorDetails<T>(operation: Promise<T>): Promise<T> {
  return operation.catch((error: unknown) => {
    if (error instanceof StudyTutorError) {
      throw formatStudyTutorError(error);
    }

    throw error;
  });
}

async function resolveInstallPack(packId: string, options: InstallCommandOptions): Promise<ResolvedInstallPack> {
  const registry = options.registry?.trim();
  const registryUrl = options.registryUrl?.trim();

  if (registry && registryUrl) {
    throw new Error("Use either --registry or --registry-url, not both");
  }

  if (registry || registryUrl) {
    const url = registry ? await withStudyTutorErrorDetails(resolveRegistryUrl({ name: registry })) : registryUrl;
    if (!url) {
      throw new Error("Missing registry URL");
    }

    const resolved = await withStudyTutorErrorDetails(resolveRegistryPack({ registryUrl: url, packId }));
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
      type: "bundled",
      path: "packs/jpa-tutor-pack"
    },
    snapshotSourceRoot: undefined,
    cleanup: undefined
  };
}

export async function runInstallCommand(packId: string, options: InstallCommandOptions = {}): Promise<void> {
  const resolvedPack = await resolveInstallPack(packId, options);
  console.log("JPA Tutor Pack을 설치합니다.\n");

  const directoryName = normalizeInstallDirectoryName(await input({
    message: "어디에 설치할까요?",
    default: "mini-jpa-study",
    validate: validateInstallDirectoryName
  }));

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
  try {
    await installTutorProject({
      pack: resolvedPack.pack,
      projectRoot,
      courseId,
      source: resolvedPack.source,
      snapshotSourceRoot: resolvedPack.snapshotSourceRoot
    });
  } finally {
    await resolvedPack.cleanup?.();
  }

  console.log(formatInstallSuccess({ directoryName, projectRoot }));
}
