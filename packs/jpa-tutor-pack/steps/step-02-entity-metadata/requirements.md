# Step 02. EntityMetadata 추출하기

## 목적

Step 01에서 만든 annotation을 runtime reflection으로 읽어 ORM metadata를 만든다.

## 요구사항

- `EntityMetadataExtractor.extract(Class<?>)`를 구현한다.
- `@Entity`가 붙은 클래스만 entity로 인정한다.
- `@Table(name = "...")`에서 table name을 추출한다.
- `@Id`가 붙은 필드를 identifier column으로 인식한다.
- `@Column(name = "...")`에서 column name을 추출한다.
- `EntityMetadata`는 `tableName()`, `idColumn()`, `columns()`를 제공한다.
- `ColumnMetadata`는 `fieldName()`, `columnName()`, `javaType()`, `id()`를 제공한다.

## 구현 위치

- `src/main/java/io/tutor/minijpa/EntityMetadata.java`
- `src/main/java/io/tutor/minijpa/ColumnMetadata.java`
- `src/main/java/io/tutor/minijpa/EntityMetadataExtractor.java`
