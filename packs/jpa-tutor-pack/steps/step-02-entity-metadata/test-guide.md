# Step 02 테스트 작성 가이드

`src/test/java/learner` 아래에 metadata extraction 테스트를 직접 작성한다.

추천 테스트:

- 정상 entity에서 table name을 추출한다.
- `@Id` 필드가 id column으로 표시되는지 확인한다.
- field name과 column name이 다를 때 column name을 보존하는지 확인한다.
- column 순서가 class field 선언 순서를 따르는지 확인한다.
