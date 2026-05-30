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

type CourseChoice = {
  name: string;
  value: string;
  disabled?: string;
};

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

function hasOption(options: InstallCommandOptions, key: keyof InstallCommandOptions): boolean {
  return Object.prototype.hasOwnProperty.call(options, key) && options[key] !== undefined;
}

async function resolveInstallPack(packId: string, options: InstallCommandOptions): Promise<ResolvedInstallPack> {
  const hasRegistry = hasOption(options, "registry");
  const hasRegistryUrl = hasOption(options, "registryUrl");
  const registry = options.registry?.trim();
  const registryUrl = options.registryUrl?.trim();

  if (hasRegistry && hasRegistryUrl) {
    throw new Error("Use either --registry or --registry-url, not both");
  }

  if (hasRegistry && !registry) {
    throw new Error("Missing registry name");
  }

  if (hasRegistryUrl && !registryUrl) {
    throw new Error("Missing registry URL");
  }

  if (hasRegistry || hasRegistryUrl) {
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

function buildCourseChoices(resolvedPack: ResolvedInstallPack): CourseChoice[] {
  const choices = resolvedPack.pack.activeCourses.map((course) => ({
    name: course.title,
    value: course.id
  }));

  if (resolvedPack.source.type === "bundled" && resolvedPack.source.path === "packs/jpa-tutor-pack") {
    choices.push(...resolvedPack.pack.comingSoonCourses.map((course) => ({
      name: `${course.title} (coming soon)`,
      value: course.id,
      disabled: "coming soon"
    })));
  }

  return choices;
}

async function selectCourse(resolvedPack: ResolvedInstallPack): Promise<string> {
  return select<string>({
    message: "어떤 방식으로 학습할까요?",
    choices: buildCourseChoices(resolvedPack)
  });
}

async function cleanupResolvedPack(resolvedPack: ResolvedInstallPack, primaryError?: unknown): Promise<void> {
  try {
    await resolvedPack.cleanup?.();
  } catch (cleanupError) {
    if (primaryError) {
      return;
    }

    throw cleanupError;
  }
}

export async function runInstallCommand(packId: string, options: InstallCommandOptions = {}): Promise<void> {
  const resolvedPack = await resolveInstallPack(packId, options);
  let primaryError: unknown;

  try {
    console.log(`${resolvedPack.pack.metadata.name}을 설치합니다.\n`);

    const directoryName = normalizeInstallDirectoryName(await input({
      message: "어디에 설치할까요?",
      default: "mini-jpa-study",
      validate: validateInstallDirectoryName
    }));

    const courseId = await selectCourse(resolvedPack);
    const projectRoot = resolve(process.cwd(), directoryName);

    await installTutorProject({
      pack: resolvedPack.pack,
      projectRoot,
      courseId,
      source: resolvedPack.source,
      snapshotSourceRoot: resolvedPack.snapshotSourceRoot
    });

    console.log(formatInstallSuccess({ directoryName, projectRoot }));
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    await cleanupResolvedPack(resolvedPack, primaryError);
  }
}
