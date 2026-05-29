# Mini JPA Study

이 프로젝트는 `study-tutor`가 생성한 JPA 학습 프로젝트입니다.

## CLI 실행

패키지로 설치하거나 링크한 환경에서는 `study-tutor test`처럼 실행할 수 있습니다. 로컬 repo 개발 중에는 생성된 학습 프로젝트에 `study-tutor` 바이너리가 자동으로 설치되지 않으므로, 빌드된 CLI 파일의 절대 경로를 `node`로 실행합니다.

```bash
node /path/to/study-tutor/apps/cli/dist/index.js status
node /path/to/study-tutor/apps/cli/dist/index.js test
node /path/to/study-tutor/apps/cli/dist/index.js next
```

## 학습 흐름

1. `.tutor/steps/<current-step>/requirements.md`를 읽습니다.
2. `src/test/java/learner` 아래에 직접 테스트를 작성합니다.
3. `src/main/java/io/tutor/minijpa` 아래에 구현합니다.
4. `node /path/to/study-tutor/apps/cli/dist/index.js test`로 learner test와 public sanity test를 실행합니다.
5. 준비되면 `node /path/to/study-tutor/apps/cli/dist/index.js next`로 edge-case TCK까지 확인하고 다음 step으로 이동합니다.
