# Step 01 테스트 작성 가이드

`src/test/java/learner` 아래에 직접 테스트를 작성한다.

추천 테스트:

- `@Entity`가 클래스에 붙고 runtime에 읽히는지 확인한다.
- `@Table(name = "members")` 값을 reflection으로 읽는다.
- `@Id`가 필드에 붙는지 확인한다.
- `@Column(name = "member_name")` 값을 reflection으로 읽는다.
- annotation의 `@Target`과 `@Retention` 정책을 확인한다.
