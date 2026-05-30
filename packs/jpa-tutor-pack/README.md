# JPA Tutor Pack

JPA Tutor Pack은 Mini Hibernate를 직접 구현하면서 JPA의 핵심 개념을 익히는 Study Tutor pack입니다.

## Pack ID

```bash
jpa-tutor-pack
```

## 요구 환경

- Java 21
- Gradle wrapper는 생성되는 학습 프로젝트에 포함됩니다.

Study Tutor CLI 자체는 Node.js로 실행되지만, 이 pack의 `test`와 `next`는 생성된 Java/Gradle 학습 프로젝트의 테스트를 실행하므로 Java 21이 필요합니다.

## 코스

현재 활성 코스:

- Mini Hibernate로 배우는 JPA

준비 중인 코스:

- JPA 개념 중심 실습
- Spring Data JPA 실무 패턴
- 면접 대비 집중 코스

## Step

1. Entity Annotation 만들기
2. EntityMetadata 추출하기
3. Select SQL 생성하기

## 설치

repo root에서 빠르게 설치할 때:

```bash
pnpm cli -- install jpa-tutor-pack
```

원하는 workspace 위치에서 빌드된 CLI를 직접 실행할 때:

```bash
node /path/to/study-tutor/apps/cli/dist/index.js install jpa-tutor-pack
```

## 학습 프로젝트 실행

생성된 학습 프로젝트 안에서:

```bash
node /path/to/study-tutor/apps/cli/dist/index.js status
node /path/to/study-tutor/apps/cli/dist/index.js test
node /path/to/study-tutor/apps/cli/dist/index.js next
```

패키지로 설치하거나 링크한 환경에서는 같은 명령을 `study-tutor` 바이너리로 실행할 수 있습니다.

## 학습 흐름

1. `.tutor/steps/<current-step>/requirements.md`를 읽습니다.
2. `src/test/java/learner` 아래에 직접 테스트를 작성합니다.
3. `src/main/java/io/tutor/minijpa` 아래에 구현합니다.
4. `test` 명령으로 learner test와 public sanity test를 실행합니다.
5. `next` 명령으로 edge-case TCK까지 확인하고 다음 step으로 이동합니다.
