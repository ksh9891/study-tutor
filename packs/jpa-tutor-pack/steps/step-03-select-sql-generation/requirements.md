# Step 03. Select SQL 생성하기

## 목적

Step 02의 EntityMetadata를 기반으로 `findById`에 사용할 SQL을 생성한다.

## 요구사항

- `SelectSqlGenerator.generateFindByIdSql(EntityMetadata)`를 구현한다.
- SELECT 절에는 metadata의 column name을 순서대로 사용한다.
- FROM 절에는 metadata의 table name을 사용한다.
- WHERE 절에는 id column name을 사용한다.
- 값은 직접 문자열로 넣지 않고 `?` parameter marker를 사용한다.

## 구현 위치

- `src/main/java/io/tutor/minijpa/SelectSqlGenerator.java`
