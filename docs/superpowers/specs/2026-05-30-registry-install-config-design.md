# Registry Install And Config Design

## 1. Goal

Study Tutor의 registry 기능을 조회 전용에서 실제 설치 흐름까지 확장한다.

사용자는 marketplace Git repo를 한 번 등록한 뒤, 등록된 이름으로 pack 목록을 조회하고 pack을 설치할 수 있다.

```bash
study-tutor registry add official https://github.com/me/study-tutor-marketplace.git
study-tutor registry list --registry official
study-tutor install jpa-tutor-pack --registry official
```

일회성 URL 사용도 유지한다.

```bash
study-tutor registry list --url https://github.com/me/study-tutor-marketplace.git
study-tutor install jpa-tutor-pack --registry-url https://github.com/me/study-tutor-marketplace.git
```

## 2. Scope

포함한다:

- `study-tutor registry add <name> <git-repo-url>`
- `study-tutor registry list --registry <name>`
- 기존 `study-tutor registry list --url <git-repo-url>` 유지
- `study-tutor install <pack-id> --registry <name>`
- `study-tutor install <pack-id> --registry-url <git-repo-url>`
- registry 설정 파일 저장과 읽기
- registry manifest에서 pack repo URL과 `defaultRef`를 찾기
- pack repo를 임시 디렉터리에 clone하고 `defaultRef`를 checkout
- checkout된 pack repo를 기존 `loadTutorPack()`과 `installTutorProject()`로 설치
- registry에서 설치한 pack snapshot을 생성된 학습 프로젝트 안에 저장
- `status`와 `next`가 registry 설치 프로젝트의 local pack snapshot을 사용
- `.tutor/pack.lock`에 registry 기반 source 정보 기록
- 설정 저장, pack repo clone, checkout, install 실패에 대한 사용자 친화적 오류
- core와 CLI 테스트

포함하지 않는다:

- `registry remove`, `registry rename`, `registry default`, `registry use`
- 기본 registry 자동 선택
- pack version resolution
- commit sha pinning
- 여러 registry에서 같은 pack id가 있을 때 자동 탐색
- registry manifest 검색/필터링
- 원격 서버, DB, 웹 UI
- hidden TCK server

## 3. CLI UX

### 3.1 Registry 등록

```bash
study-tutor registry add official https://github.com/me/study-tutor-marketplace.git
```

성공 출력:

```text
Registry added: official
URL: https://github.com/me/study-tutor-marketplace.git
```

`name` 규칙은 기존 id 규칙과 같은 소문자, 숫자, hyphen이다. 이미 같은 이름이 있으면 덮어쓰지 않고 실패한다.

`registry add`는 URL을 저장만 한다. URL이 실제로 clone 가능한지는 `registry list` 또는 `install` 시점에 검증된다.

### 3.2 Registry 조회

기존 URL 직접 조회:

```bash
study-tutor registry list --url https://github.com/me/study-tutor-marketplace.git
```

저장된 registry 조회:

```bash
study-tutor registry list --registry official
```

`--registry`와 `--url`은 동시에 사용할 수 없다. 둘 중 하나는 반드시 필요하다.

### 3.3 Registry 기반 설치

저장된 registry에서 설치:

```bash
study-tutor install jpa-tutor-pack --registry official
```

URL 직접 지정 설치:

```bash
study-tutor install jpa-tutor-pack --registry-url https://github.com/me/study-tutor-marketplace.git
```

기존 bundled 설치는 유지한다.

```bash
study-tutor install jpa-tutor-pack
```

이 명령은 지금처럼 bundled `jpa-tutor-pack`을 설치한다. Registry 기반 설치는 명시적인 옵션이 있을 때만 동작한다.

## 4. Config Contract

사용자 registry 설정은 전역 파일에 저장한다.

```text
~/.study-tutor/registries.json
```

파일 구조:

```json
{
  "registries": {
    "official": {
      "url": "https://github.com/me/study-tutor-marketplace.git"
    }
  }
}
```

규칙:

- 파일이 없으면 registry 목록은 빈 상태로 본다.
- `registry add`는 디렉터리와 파일을 생성한다.
- `registry add`는 같은 이름을 덮어쓰지 않는다.
- 손상된 JSON이나 schema 불일치는 명확한 오류로 실패한다.
- 테스트에서는 home/config root를 주입할 수 있어야 한다.

## 5. Marketplace And Pack Contract

Marketplace repo의 `packs.yaml` 구조는 기존 registry list MVP와 같다.

```yaml
packs:
  - id: jpa-tutor-pack
    name: JPA Tutor Pack
    description: Mini Hibernate를 구현하며 JPA를 배우는 pack
    repo: https://github.com/me/jpa-tutor-pack.git
    defaultRef: main
    tags:
      - java
      - jpa
      - backend
```

설치 시 CLI는 `packs.yaml`에서 `id`가 일치하는 항목을 찾는다. 없으면 실패한다.

Pack repo는 repo root에 Study Tutor pack 구조를 가져야 한다.

```text
pack.yaml
curriculum.yaml
templates/
steps/
README.md
```

MVP에서는 pack repo 안의 subdirectory pack은 지원하지 않는다.

Registry 기반 install은 checkout된 pack repo 전체를 생성된 학습 프로젝트의 `.tutor/pack`에 snapshot으로 복사한다. 이후 `status`와 `next`는 네트워크에 다시 접근하지 않고 이 local snapshot을 사용한다.

## 6. Architecture

기존 구조를 유지하면서 registry config와 pack repo resolver를 core에 추가한다.

```text
apps/cli
  src/index.ts
  src/commands/install.ts
  src/commands/registry.ts

packages/tutor-core
  src/registry/schema.ts
  src/registry/loader.ts
  src/registry/config-store.ts
  src/registry/pack-resolver.ts
```

역할:

- `registry/schema.ts`: marketplace manifest schema와 registry config schema를 정의한다.
- `registry/config-store.ts`: `registries.json` 읽기, 쓰기, 중복 등록 방지를 담당한다.
- `registry/loader.ts`: marketplace Git repo clone과 `packs.yaml` load를 유지한다.
- `registry/pack-resolver.ts`: registry manifest에서 pack을 찾고 pack repo를 clone/checkout해 local pack root를 제공한다.
- `install.ts`: install 옵션에 따라 bundled pack 또는 registry pack을 선택한다.
- `registry.ts`: `registry add`, `registry list` command UX를 담당한다.
- `status.ts`, `next.ts`: `pack.lock` source에 따라 bundled pack 또는 `.tutor/pack` snapshot을 load한다.

CLI는 사용자 입력, 출력, prompt만 담당한다. 파일 시스템 저장 규칙, clone, manifest parsing은 core에 둔다.

## 7. Data Flow

### 7.1 Registry Add

1. 사용자가 `registry add official <url>`을 실행한다.
2. CLI가 name과 URL을 core config store에 넘긴다.
3. Core가 `~/.study-tutor/registries.json`을 읽는다.
4. 같은 이름이 없으면 새 registry를 추가한다.
5. Core가 설정 파일을 저장한다.
6. CLI가 성공 메시지를 출력한다.

### 7.2 Registry List By Name

1. 사용자가 `registry list --registry official`을 실행한다.
2. CLI가 config store에서 `official` URL을 읽는다.
3. 기존 `loadRegistryManifest({ url })`로 manifest를 읽는다.
4. 기존 list formatter로 출력한다.

### 7.3 Install From Registry

1. 사용자가 `install jpa-tutor-pack --registry official`을 실행한다.
2. CLI가 `official` registry URL을 config store에서 찾는다.
3. Core가 marketplace manifest를 clone/read한다.
4. Core가 `jpa-tutor-pack` 항목을 찾는다.
5. Core가 pack repo를 임시 디렉터리에 clone한다.
6. Core가 `defaultRef`를 checkout한다.
7. Core가 clone된 pack root를 `loadTutorPack()`으로 읽는다.
8. CLI가 기존 install prompt로 directory와 course를 선택한다.
9. Core가 `installTutorProject()`를 실행한다.
10. Core가 clone된 pack repo 전체를 `.tutor/pack`으로 복사한다.
11. `pack.lock`에는 source를 registry 기반으로 기록한다.
12. 임시 pack repo와 registry clone 디렉터리는 정리한다.

### 7.4 Status And Next After Registry Install

1. `status` 또는 `next`가 `.tutor/pack.lock`을 읽는다.
2. `source.type`이 `bundled`면 기존처럼 CLI에 bundled된 pack root를 사용한다.
3. `source.type`이 `registry`면 생성된 프로젝트의 `.tutor/pack`을 pack root로 사용한다.
4. `.tutor/pack`이 없거나 schema가 깨져 있으면 local pack snapshot 오류로 실패한다.
5. `next`는 `.tutor/pack`에서 다음 step artifact와 TCK를 가져와 기존 step 진행 정책을 그대로 적용한다.

`pack.lock` source 예:

```yaml
source:
  type: registry
  registryUrl: https://github.com/me/study-tutor-marketplace.git
  packRepo: https://github.com/me/jpa-tutor-pack.git
  ref: main
  localSnapshot: .tutor/pack
```

새로 설치하는 project의 `pack.lock`은 source object를 기록한다. 기존에 생성된 project의 `source`가 string인 경우도 읽기에서는 계속 지원한다. 구형 string source는 bundled source로 해석한다.

기존 bundled install은 다음처럼 기록한다.

```yaml
source:
  type: bundled
  path: packs/jpa-tutor-pack
```

## 8. Error Handling

다음 오류는 명확한 메시지와 detail을 보여준다.

- registry name이 invalid한 경우
- registry name이 이미 존재하는 경우
- registry config 파일이 손상된 경우
- 지정한 registry name이 없는 경우
- `--registry`와 `--url` 또는 `--registry-url`을 함께 사용한 경우
- marketplace clone 실패
- marketplace `packs.yaml` schema 오류
- pack id가 marketplace에 없는 경우
- pack repo clone 실패
- `defaultRef` checkout 실패
- pack repo가 Study Tutor pack schema를 만족하지 않는 경우
- `.tutor/pack` snapshot 복사 실패
- registry 설치 프로젝트에서 `.tutor/pack` snapshot이 없거나 깨진 경우
- install target이 이미 존재하는 경우

Git 명령은 URL 앞에 `--`를 넣어 dash-prefixed input이 Git option으로 해석되지 않게 한다.

## 9. Testing

Core tests:

- registry config 파일이 없으면 빈 registry 목록을 반환한다.
- `registry add`가 새 파일을 만든다.
- duplicate registry add가 실패한다.
- invalid registry name이 실패한다.
- 손상된 config JSON이 실패한다.
- registry name으로 URL을 resolve한다.
- manifest에서 pack id를 찾는다.
- 없는 pack id는 실패한다.
- pack repo clone과 `defaultRef` checkout이 호출된다.
- pack repo clone/checkout 실패가 detail과 함께 실패한다.
- temp directory cleanup이 성공/실패 경로 모두에서 수행된다.
- registry install이 `.tutor/pack` snapshot을 생성한다.
- registry 설치 프로젝트의 pack root resolver가 `.tutor/pack`을 반환한다.
- `.tutor/pack`이 없으면 status/next용 resolver가 실패한다.
- 구형 string `pack.lock.source`는 bundled source로 읽힌다.

CLI tests:

- `registry add`가 core store를 호출하고 성공 메시지를 출력한다.
- `registry list --registry official`이 저장된 URL로 manifest를 읽는다.
- `registry list`에서 `--registry`와 `--url` 동시 사용이 실패한다.
- `install --registry official`이 registry pack resolver를 사용한다.
- `install --registry-url <url>`이 URL 기반 resolver를 사용한다.
- 옵션 없는 `install <pack-id>`는 기존 bundled 경로를 유지한다.
- registry install 실패 시 detail이 출력된다.
- registry 설치 후 `status`와 `next`가 `.tutor/pack` snapshot을 사용한다.

Integration smoke:

- 임시 marketplace Git repo와 임시 pack Git repo를 만든다.
- marketplace `packs.yaml`이 pack repo를 가리키게 한다.
- `node apps/cli/dist/index.js registry add local <marketplace-path>`를 실행한다.
- `node apps/cli/dist/index.js registry list --registry local`이 pack을 출력한다.
- `node apps/cli/dist/index.js install jpa-tutor-pack --registry local`이 학습 프로젝트를 생성한다.
- 생성된 학습 프로젝트 안에서 `status`, `test`, `next`가 실행된다.

## 10. Acceptance Criteria

- 사용자는 registry URL을 이름으로 저장할 수 있다.
- 사용자는 저장된 registry 이름으로 pack 목록을 조회할 수 있다.
- 사용자는 저장된 registry 이름으로 pack을 설치할 수 있다.
- 사용자는 registry URL을 저장하지 않고 one-off로 pack을 조회하거나 설치할 수 있다.
- 기존 bundled `study-tutor install jpa-tutor-pack` 동작은 유지된다.
- registry 기반 install은 pack repo를 clone하고 `defaultRef`를 checkout한다.
- registry 기반 install은 pack snapshot을 `.tutor/pack`에 저장한다.
- registry 기반 install 후 `status`와 `next`는 `.tutor/pack`을 사용한다.
- 설치된 project의 `pack.lock`은 bundled source와 registry source를 구분한다.
- 잘못된 registry config, missing pack, clone 실패, checkout 실패는 actionable detail을 출력한다.
- 전체 test/build/smoke가 통과한다.

## 11. Future Work

- `study-tutor registry remove <name>`
- `study-tutor registry list-sources`
- `study-tutor registry default <name>`
- `study-tutor list` alias
- install 시 registry 자동 탐색
- commit sha pinning
- pack version range와 compatibility check
- registry manifest에 author, license, homepage, level 추가
