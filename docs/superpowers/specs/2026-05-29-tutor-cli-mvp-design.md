# Tutor CLI Phase 1 MVP Design

작성일: 2026-05-29

## 1. 요약

Tutor CLI의 Phase 1 MVP는 개발자가 JPA/Hibernate의 핵심 개념을 직접 테스트하고 구현하면서 배우도록 돕는 로컬 CLI 학습 런타임이다.

MVP는 `study-tutor install jpa-tutor-pack`으로 Java 학습 프로젝트를 새 디렉토리에 생성하고, 학습자가 step별 요구사항을 읽고 learner test와 구현을 작성한 뒤 `study-tutor test`, `study-tutor next`로 다음 step으로 진행하는 흐름을 제공한다.

핵심 제품 방향은 "설명보다 구현"과 "하나의 코드베이스가 계속 성장하는 학습 경험"이다. 따라서 최초 install 이후 `src/main/java`는 CLI가 수정하지 않고, 각 step은 문서와 검증 테스트를 추가하는 방식으로만 진행된다.

## 2. 목표

- TypeScript와 pnpm workspace 기반으로 Phase 1 MVP 전체를 구현할 수 있는 구조를 정의한다.
- CLI 명령어 `install`, `status`, `test`, `next`의 동작과 책임을 정의한다.
- 로컬 bundled pack인 `jpa-tutor-pack`의 초기 구조를 정의한다.
- JPA Tutor Pack step 1~3을 실행 가능한 수준으로 구성한다.
- learner test 작성 강제, public sanity test, edge-case TCK를 분리한다.
- TCK 실패 시 `tck.yaml` 기반 학습 메시지를 제공한다.
- pack은 현재 repo 안에 두되, 나중에 별도 local path나 별도 repo로 분리할 수 있게 pack loader 경계를 둔다.

## 3. 비목표

- 원격 pack registry 또는 pack marketplace를 만들지 않는다.
- GitHub App, PR review bot, hidden TCK server를 만들지 않는다.
- 웹 UI, DB, 로그인, 결제, 조직 관리 기능을 만들지 않는다.
- 여러 학습 코스를 실제로 구현하지 않는다. MVP에서는 Mini Hibernate 코스만 활성화한다.
- step 진행 중 learner의 `src/main/java` 코드를 생성하거나 수정하지 않는다.
- TCK를 숨겨진 테스트로 운영하지 않는다. MVP에서는 공개된 edge-case TCK로 둔다.

## 4. 아키텍처

MVP는 brief의 장기 구조보다 단순한 `apps/cli` + `packages/tutor-core` 구조를 사용한다.

```text
study-tutor/
 ├─ apps/
 │   └─ cli/
 │       ├─ src/
 │       │   ├─ index.ts
 │       │   └─ commands/
 │       │       ├─ install.ts
 │       │       ├─ status.ts
 │       │       ├─ test.ts
 │       │       └─ next.ts
 │       └─ package.json
 │
 ├─ packages/
 │   └─ tutor-core/
 │       ├─ src/
 │       │   ├─ pack/
 │       │   │   ├─ schema.ts
 │       │   │   ├─ loader.ts
 │       │   │   └─ installer.ts
 │       │   ├─ progress/
 │       │   │   └─ progress-store.ts
 │       │   ├─ steps/
 │       │   │   └─ step-service.ts
 │       │   ├─ test/
 │       │   │   ├─ gradle-runner.ts
 │       │   │   └─ tck-runner.ts
 │       │   └─ index.ts
 │       └─ package.json
 │
 ├─ packs/
 │   └─ jpa-tutor-pack/
 ├─ examples/
 │   └─ mini-jpa-study/
 ├─ package.json
 ├─ pnpm-workspace.yaml
 ├─ tsconfig.json
 └─ README.md
```

`apps/cli`는 commander 기반 명령어, interactive prompt, 터미널 출력만 담당한다. pack 로딩, 설치, progress 관리, step 이동, Gradle 실행, TCK 실행 규칙은 `packages/tutor-core`에 둔다.

## 5. CLI 명령

CLI 명령 이름은 `study-tutor`를 사용한다.

```bash
study-tutor install jpa-tutor-pack
study-tutor status
study-tutor test
study-tutor next
```

### 5.1 `study-tutor install jpa-tutor-pack`

MVP에서는 새 디렉토리 생성 설치만 지원한다. 현재 디렉토리 설치, 기존 Git repository에 추가, 원격 pack 설치는 지원하지 않는다.

설치 UX는 interactive flow를 사용한다.

```text
JPA Tutor Pack을 설치합니다.

어디에 설치할까요?
> mini-jpa-study

어떤 방식으로 학습할까요?
1. Mini Hibernate 구현
2. JPA 개념 중심 실습 (coming soon)
3. Spring Data JPA 실무 패턴 (coming soon)
4. 면접 대비 집중 코스 (coming soon)

선택: 1
```

Mini Hibernate만 active course다. coming soon course를 선택하면 아직 지원하지 않는다는 메시지를 보여주고 다시 선택하게 한다.

Java package 기본값은 `io.tutor.minijpa`로 고정한다. 프로젝트 디렉토리 이름은 사용자가 입력한다.

### 5.2 `study-tutor status`

현재 학습 상태와 다음 행동을 함께 보여준다.

```text
Pack: jpa-tutor-pack@0.1.0
Course: Mini Hibernate로 배우는 JPA
Current Step: 01 - Entity Annotation 만들기
Completed Steps: 0/3

Next action:
- .tutor/steps/step-01-entity-annotations/requirements.md를 읽으세요.
- src/test/java/learner 아래에 직접 테스트를 작성하세요.
- 구현 후 study-tutor test를 실행하세요.
- 준비되면 study-tutor next를 실행하세요.
```

### 5.3 `study-tutor test`

일반 학습 루프용 테스트 명령이다.

```text
study-tutor test
→ .tutor/progress.json 확인
→ ./gradlew test 실행
→ learner tests + 현재까지 복사된 public sanity tests 실행
```

TCK는 `study-tutor test`에서 실행하지 않는다. TCK는 step 완료 판정인 `study-tutor next`에서만 실행한다.

### 5.4 `study-tutor next`

현재 step 완료 판정과 다음 step 해금을 담당한다.

```text
study-tutor next
→ learner test 파일 존재 확인
→ ./gradlew test 실행
→ 현재 step TCK를 임시 복사해서 실행
→ 실패 시 tck.yaml 기반 학습 메시지 출력
→ 통과 시 progress.json 갱신
→ 다음 step 문서 + public sanity test + TCK 자료 추가
```

learner test 파일은 `src/test/java/learner/**/*Test.java` 패턴으로 최소 1개 이상 존재해야 한다. MVP에서는 테스트 내용의 품질을 정적으로 판정하지 않는다.

## 6. 생성되는 학습 프로젝트

`study-tutor install jpa-tutor-pack` 실행 결과는 다음 구조를 가진다.

```text
mini-jpa-study/
 ├─ .tutor/
 │   ├─ progress.json
 │   ├─ pack.lock
 │   └─ steps/
 │       └─ step-01-entity-annotations/
 │           ├─ requirements.md
 │           ├─ test-guide.md
 │           ├─ review-rubric.md
 │           ├─ tck.yaml
 │           └─ tck-tests/
 │
 ├─ src/
 │   ├─ main/java/io/tutor/minijpa/
 │   └─ test/java/
 │       ├─ learner/
 │       └─ publictests/step01/
 │
 ├─ build.gradle
 ├─ settings.gradle
 └─ README.md
```

최초 Gradle project template은 install 시 생성한다. 이후 step 이동 시 `src/main/java`는 수정하지 않는다.

## 7. Progress 저장

진행 상태는 `.tutor/progress.json`에 저장한다.

```json
{
  "pack": "jpa-tutor-pack",
  "version": "0.1.0",
  "course": "mini-hibernate",
  "currentStep": "step-01-entity-annotations",
  "completedSteps": []
}
```

`pack.lock`에는 설치 시 사용한 pack id, version, course id, pack source 정보를 기록한다. MVP의 pack source는 repo 내부 `packs/jpa-tutor-pack`이다.

## 8. Pack 구조

MVP pack은 같은 repository의 `packs/jpa-tutor-pack`에 둔다.

```text
packs/jpa-tutor-pack/
 ├─ pack.yaml
 ├─ curriculum.yaml
 ├─ templates/
 │   └─ gradle-project/
 └─ steps/
     ├─ step-01-entity-annotations/
     │   ├─ step.yaml
     │   ├─ requirements.md
     │   ├─ test-guide.md
     │   ├─ review-rubric.md
     │   ├─ public-tests/
     │   ├─ tck-tests/
     │   └─ tck.yaml
     ├─ step-02-entity-metadata/
     └─ step-03-select-sql-generation/
```

`pack.yaml`은 pack identity와 runtime 정보를 담는다.

```yaml
id: jpa-tutor-pack
name: JPA Tutor Pack
version: 0.1.0
language: java
runtime:
  java: "21"
  buildTool: gradle
initialStep: step-01-entity-annotations
```

`curriculum.yaml`은 active course와 coming soon course를 구분한다.

```yaml
courses:
  - id: mini-hibernate
    title: Mini Hibernate로 배우는 JPA
    status: active
    steps:
      - step-01-entity-annotations
      - step-02-entity-metadata
      - step-03-select-sql-generation
  - id: jpa-concepts-practice
    title: JPA 개념 중심 실습
    status: coming-soon
  - id: spring-data-jpa-practice
    title: Spring Data JPA 실무 패턴
    status: coming-soon
  - id: jpa-interview-focus
    title: 면접 대비 집중 코스
    status: coming-soon
```

## 9. Step과 TCK 정책

MVP step은 3개다.

- Step 01: `@Entity`, `@Table`, `@Id`, `@Column` annotation 만들기
- Step 02: EntityMetadata 추출하기
- Step 03: findById용 select SQL 생성하기

각 step은 다음 파일을 가진다.

```text
requirements.md
→ 이번 step의 목적, 요구사항, 구현 목표

test-guide.md
→ 학습자가 직접 작성해야 할 테스트 아이디어

review-rubric.md
→ 스스로 점검할 기준

public-tests/
→ study-tutor test에서 실행되는 최소 계약 테스트

tck-tests/
→ study-tutor next에서만 임시 복사되어 실행되는 edge-case 테스트

tck.yaml
→ 실패한 edge case를 학습 메시지로 설명하기 위한 metadata
```

public sanity test와 TCK의 역할은 분리한다.

- public sanity test는 다음 step으로 넘어가기 위한 기본 계약을 확인한다.
- TCK는 놓치기 쉬운 edge case와 스펙 경계를 확인한다.
- TCK는 공개 자료로 두지만 일반 test에서는 실행하지 않는다.
- `next`는 TCK까지 통과해야 다음 step으로 이동한다.

`tck.yaml` 예시는 다음과 같다.

```yaml
edgeCases:
  entity-without-id:
    testClass: EntityWithoutIdTckTest
    title: "@Id가 없는 Entity"
    whyImportant: "ORM은 식별자 없는 객체를 영속성 컨텍스트에서 관리할 수 없습니다."
    hint: "EntityMetadataExtractor가 @Id 필드를 정확히 하나만 허용하도록 검증해보세요."
```

TCK 실패 시 CLI는 JUnit 실패 로그와 함께 `title`, `whyImportant`, `hint`를 출력한다.

## 10. 안전 정책

학습자 코드 보존을 최우선으로 한다.

- 최초 install 이후 `src/main/java`는 CLI가 수정하지 않는다.
- `next`는 다음 step의 문서, public test, TCK 자료만 추가한다.
- 기존 파일을 덮어쓰지 않는다.
- 생성하려는 파일이 이미 있으면 작업을 중단하고 충돌 파일 목록을 보여준다.
- `progress.json`은 step 전환이 모두 성공한 뒤 마지막에 갱신한다.

주요 오류 처리는 다음과 같다.

- 설치 대상 디렉토리가 이미 존재하면 중단하고 다른 이름을 입력하게 한다.
- pack schema 검증 실패 시 파일명과 필드명을 출력한다.
- `.tutor/progress.json`이 없으면 학습 프로젝트 루트에서 실행했는지 확인하라고 안내한다.
- learner test 파일이 없으면 `next`를 실패 처리한다.
- Gradle test 실패 시 로그를 보여주고 `next`를 중단한다.
- TCK 실패 시 실패한 테스트명과 `tck.yaml` 기반 학습 메시지를 출력한다.
- 마지막 step에서 `next`를 실행하면 모든 step이 완료되었음을 안내한다.

## 11. TCK 실행 방식

TCK는 임시 복사 방식으로 실행한다.

```text
.tutor/steps/<current-step>/tck-tests
→ 임시 테스트 경로로 복사
→ Gradle로 TCK 테스트 실행
→ 성공/실패와 관계없이 임시 파일 정리
```

구현은 학습자의 `src/main/java`와 `src/test/java/learner`를 수정하지 않는 방식이어야 한다. 임시 파일이 남아 있을 경우 다음 TCK 실행 전에 stale tmp를 먼저 정리한다.

## 12. 테스트 전략

`packages/tutor-core`에는 다음 단위 테스트를 둔다.

- pack schema 검증
- curriculum과 step 순서 로딩
- install 결과 구조 생성
- progress-store read/write
- learner test 파일 존재 검사
- public sanity test 실행 실패와 성공 처리
- TCK 실행 실패와 성공 처리
- `tck.yaml` metadata 매핑
- 충돌 파일 감지

E2E smoke test는 다음 흐름을 검증한다.

```text
1. 임시 디렉토리에 study-tutor install jpa-tutor-pack 실행
2. 생성된 Java 프로젝트 구조 확인
3. Step 01 learner test와 구현 코드를 fixture로 추가
4. study-tutor test 실행
5. study-tutor next 실행
6. Step 02 자료가 추가되고 progress.json이 갱신되는지 확인
```

## 13. MVP 완료 기준

- `pnpm install`이 성공한다.
- CLI를 로컬에서 `study-tutor`로 실행할 수 있다.
- `study-tutor install jpa-tutor-pack`으로 새 Java 학습 프로젝트가 생성된다.
- install interactive flow에서 Mini Hibernate만 활성 선택 가능하다.
- 생성 프로젝트에 `.tutor/progress.json`, `pack.lock`, step 01 문서가 존재한다.
- `study-tutor status`가 현재 step과 다음 행동을 안내한다.
- `study-tutor test`가 Gradle test를 실행한다.
- learner test 파일이 없으면 `study-tutor next`가 실패한다.
- TCK 실패 시 `tck.yaml` 기반 학습 메시지를 출력한다.
- TCK까지 통과하면 step 완료 처리 후 다음 step 문서, public test, TCK 자료가 추가된다.
- Step 03까지 같은 방식으로 진행할 수 있다.
- README에 철학, 설치, 사용법, MVP 제한이 설명된다.

## 14. 후속 확장 방향

- pack loader에 `--pack-path` 옵션을 추가해 별도 local pack repository를 받을 수 있게 한다.
- TCK metadata를 더 풍부하게 만들어 실패 원인과 학습 힌트를 개선한다.
- pack 콘텐츠를 사용 경험에 맞춰 보강한다.
- GitHub App, hidden TCK runner, PR review tutor는 Phase 2 이후 별도 설계로 다룬다.
