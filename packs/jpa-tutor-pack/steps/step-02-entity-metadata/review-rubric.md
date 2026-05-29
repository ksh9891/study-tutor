# Step 02 Review Rubric

- 특정 entity class에 하드코딩되어 있지 않은가?
- `Class<?>`와 reflection API를 사용해 generic하게 metadata를 만드는가?
- `@Entity`, `@Id` 누락 같은 invalid mapping을 명확한 예외로 처리하는가?
- 이후 SQL generation에서 사용할 수 있는 column metadata를 충분히 보존하는가?
