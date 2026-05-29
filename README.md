# Study Tutor

Study Tutor는 프레임워크 내부를 직접 구현하며 배우는 CLI 기반 학습 런타임입니다.

핵심 문장:

> Learn by evolving your own codebase.

학습자는 요구사항을 읽고, 직접 테스트를 작성하고, 구현하고, public sanity test와 edge-case TCK를 통과하면서 개념을 익힙니다.

## MVP 범위

- `study-tutor install jpa-tutor-pack` 패키지 바이너리
- `study-tutor status` 패키지 바이너리
- `study-tutor test` 패키지 바이너리
- `study-tutor next` 패키지 바이너리
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
CLI="$PWD/apps/cli/dist/index.js"
```

## CLI 실행

`study-tutor ...`는 패키지로 링크하거나 설치했을 때 사용할 의도된 바이너리 이름입니다. 현재 로컬 repo 개발에서는 생성된 학습 프로젝트에 이 바이너리가 자동으로 설치되지 않으므로, `pnpm build` 후 빌드된 CLI 파일을 `node`로 실행합니다.

repo root에서 설치 명령을 빠르게 실행할 때는 다음 convenience script를 사용할 수 있습니다. 이 명령은 repo root를 기준으로 학습 프로젝트를 생성합니다.

```bash
pnpm cli -- install jpa-tutor-pack
```

repo root에서 한 번만 절대 경로를 저장합니다.

```bash
CLI="$PWD/apps/cli/dist/index.js"
```

학습 프로젝트를 만들 위치를 명확히 정하려면 해당 위치로 이동한 뒤 빌드된 CLI 파일을 직접 실행합니다.

```bash
cd /path/to/workspace
node "$CLI" install jpa-tutor-pack
```

생성된 학습 프로젝트 안에서는 같은 `CLI` 경로로 현재 디렉터리를 기준으로 명령을 실행합니다.

```bash
cd mini-jpa-study
node "$CLI" status
node "$CLI" test
node "$CLI" next
```

## 학습 흐름

1. `.tutor/steps/<current-step>/requirements.md`를 읽습니다.
2. `src/test/java/learner` 아래에 직접 테스트를 작성합니다.
3. `src/main/java/io/tutor/minijpa` 아래에 구현합니다.
4. `node "$CLI" test`로 learner test와 public sanity test를 실행합니다.
5. `node "$CLI" next`로 edge-case TCK를 실행하고 다음 step으로 이동합니다.

## 프로젝트 구조

```text
apps/cli                study-tutor CLI
packages/tutor-core     pack loading, install, progress, test, next runtime
packs/jpa-tutor-pack    bundled JPA tutor pack
examples/fixtures       smoke test fixtures
```
