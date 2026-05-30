# Registry List MVP Design

## 1. Goal

Study Tutor에 pack discovery의 첫 단계를 추가한다.

사용자는 Git repo로 운영되는 marketplace를 지정하고, 그 repo에 등록된 pack 목록을 CLI에서 조회할 수 있다.

```bash
study-tutor registry list --url https://github.com/ksh9891/study-tutor-marketplace.git
```

이번 단계는 조회 전용이다. Pack 설치, registry 저장, 기본 registry 설정, 버전 pinning은 포함하지 않는다.

## 2. Scope

포함한다:

- `study-tutor registry list --url <git-repo-url>` 명령
- Git repo 기반 marketplace 조회
- marketplace root의 `packs.yaml` manifest 읽기
- manifest schema 검증
- 등록된 pack 목록 출력
- clone에 사용한 임시 디렉터리 정리
- registry loader와 CLI command 단위 테스트

포함하지 않는다:

- `study-tutor install <pack-id>`와 registry 연결
- pack repo clone 후 설치
- `registry add`, `registry remove`, `registry use` 같은 registry 관리 명령
- 기본 marketplace URL 저장
- 원격 서버, DB, 웹 UI
- pack version 또는 commit sha pinning
- hidden TCK server

## 3. Marketplace Contract

Marketplace는 Git repo 하나다. CLI는 지정된 URL의 repo를 임시 위치에 clone하고, repo root에서 `packs.yaml`을 찾는다.

```text
study-tutor-marketplace/
  packs.yaml
```

`packs.yaml`은 다음 구조를 가진다.

```yaml
packs:
  - id: jpa-tutor-pack
    name: JPA Tutor Pack
    description: Mini Hibernate를 구현하며 JPA를 배우는 pack
    repo: https://github.com/ksh9891/jpa-tutor-pack.git
    defaultRef: main
    tags:
      - java
      - jpa
      - backend
```

필드 규칙:

- `id`: pack id. 기존 pack id 규칙과 같이 소문자, 숫자, hyphen을 사용한다.
- `name`: 사용자에게 보여줄 pack 이름.
- `description`: 한두 줄 설명.
- `repo`: pack Git repo URL.
- `defaultRef`: 기본 branch, tag, 또는 ref. MVP에서는 출력만 하고 설치에는 쓰지 않는다.
- `tags`: 검색이나 필터링을 위한 태그. MVP에서는 출력만 한다.

MVP에서는 `packs.yaml` 파일명을 고정한다.

## 4. Command UX

명령어:

```bash
study-tutor registry list --url <git-repo-url>
```

출력 예:

```text
Available packs

jpa-tutor-pack
  JPA Tutor Pack
  Mini Hibernate를 구현하며 JPA를 배우는 pack
  repo: https://github.com/ksh9891/jpa-tutor-pack.git
  ref: main
  tags: java, jpa, backend
```

등록된 pack이 없으면 성공으로 처리하되 다음처럼 출력한다.

```text
No packs found in registry.
```

`--url`은 필수다. MVP에서는 저장된 기본 registry가 없기 때문에 URL이 없으면 명확한 사용법 오류를 낸다.

## 5. Architecture

기존 구조를 유지한다.

```text
apps/cli
  src/index.ts
  src/commands/registry.ts

packages/tutor-core
  src/registry/schema.ts
  src/registry/loader.ts
```

역할:

- `apps/cli/src/index.ts`: `registry` 하위 명령을 등록한다.
- `apps/cli/src/commands/registry.ts`: CLI 옵션을 받고 출력 포맷을 만든다.
- `packages/tutor-core/src/registry/schema.ts`: `packs.yaml`의 Zod schema와 타입을 정의한다.
- `packages/tutor-core/src/registry/loader.ts`: Git clone, manifest 읽기, schema 검증, 임시 디렉터리 정리를 담당한다.

Core는 CLI 출력 문자열을 만들지 않는다. Core는 검증된 registry data만 반환한다.

## 6. Data Flow

1. 사용자가 `study-tutor registry list --url <url>`을 실행한다.
2. CLI command가 URL을 core loader에 넘긴다.
3. Core loader가 임시 디렉터리를 만든다.
4. Core loader가 `git clone --depth 1 <url> <tmp>`를 실행한다.
5. Core loader가 `<tmp>/packs.yaml`을 읽고 YAML을 parse한다.
6. Schema 검증을 통과하면 pack 목록을 반환한다.
7. CLI가 pack 목록을 출력한다.
8. 성공과 실패 모두에서 임시 디렉터리를 정리한다.

## 7. Error Handling

다음 오류는 사용자가 이해할 수 있는 메시지로 표시한다.

- Git이 설치되어 있지 않거나 clone에 실패한 경우
- URL이 잘못되었거나 접근 권한이 없는 경우
- `packs.yaml`이 없는 경우
- YAML 문법이 잘못된 경우
- 필수 필드가 없거나 schema가 맞지 않는 경우

Core에서는 `StudyTutorError`를 사용하고, 가능한 경우 세부 정보를 `details`에 넣는다.

## 8. Testing

Core unit test:

- 유효한 `packs.yaml`을 읽고 pack 목록을 반환한다.
- `packs.yaml`이 없으면 실패한다.
- 잘못된 schema면 실패한다.
- clone 실패를 사용자 친화적 오류로 감싼다.
- 성공과 실패 모두에서 임시 디렉터리 정리를 시도한다.

CLI unit test:

- `registry list` 출력 포맷을 검증한다.
- pack이 없을 때 메시지를 검증한다.
- `--url` 없이 실행할 때 command validation이 실패하는지 확인한다.

실제 네트워크나 GitHub에 의존하는 테스트는 MVP 자동 테스트에 넣지 않는다. Git clone 실행은 core loader에서 주입 가능한 함수로 분리해 테스트한다.

## 9. Future Work

다음 단계 후보:

- `study-tutor registry add official <url>`로 registry 저장
- `study-tutor list`로 기본 registry pack 목록 조회
- `study-tutor install <pack-id>`가 registry에서 pack repo를 찾아 설치
- `defaultRef`를 사용한 branch/tag checkout
- commit sha pinning으로 재현 가능한 pack 설치
- registry manifest에 author, license, homepage, learning level, supported languages 추가

## 10. Acceptance Criteria

- `study-tutor registry list --url <marketplace-git-url>` 명령이 존재한다.
- CLI는 marketplace repo root의 `packs.yaml`을 읽는다.
- 유효한 manifest는 pack 목록으로 출력된다.
- 잘못된 manifest는 명확한 오류로 실패한다.
- 임시 clone 디렉터리는 성공과 실패 모두에서 정리된다.
- 기존 `install`, `status`, `test`, `next` 동작은 변하지 않는다.
