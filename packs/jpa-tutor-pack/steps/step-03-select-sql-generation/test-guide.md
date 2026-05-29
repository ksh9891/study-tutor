# Step 03 테스트 작성 가이드

`src/test/java/learner` 아래에 SQL generation 테스트를 직접 작성한다.

추천 테스트:

- column list와 table name으로 select SQL이 만들어지는지 확인한다.
- field name이 아니라 column name을 사용하는지 확인한다.
- id field가 첫 번째 필드가 아니어도 WHERE 절은 id column을 사용하는지 확인한다.
- SQL 값에는 `?` parameter marker를 사용하는지 확인한다.
