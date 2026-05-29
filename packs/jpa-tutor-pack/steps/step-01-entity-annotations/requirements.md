# Step 01. Entity Annotation 만들기

## 목적

Mini JPA의 출발점이 되는 runtime annotation을 직접 만든다.

## 요구사항

- `io.tutor.minijpa.Entity`는 클래스에 붙일 수 있어야 한다.
- `Entity`는 `RetentionPolicy.RUNTIME`으로 선언되어 runtime reflection으로 읽을 수 있어야 한다.
- `io.tutor.minijpa.Table`은 클래스에 붙일 수 있어야 한다.
- `Table`은 `String name()` 속성을 가져야 한다.
- `Table`은 `RetentionPolicy.RUNTIME`으로 선언되어 runtime reflection으로 읽을 수 있어야 한다.
- `io.tutor.minijpa.Id`는 필드에 붙일 수 있어야 한다.
- `Id`는 `RetentionPolicy.RUNTIME`으로 선언되어 runtime reflection으로 읽을 수 있어야 한다.
- `io.tutor.minijpa.Column`은 필드에 붙일 수 있어야 한다.
- `Column`은 `String name()` 속성을 가져야 한다.
- `Column`은 `RetentionPolicy.RUNTIME`으로 선언되어 runtime reflection으로 읽을 수 있어야 한다.

## 구현 위치

- `src/main/java/io/tutor/minijpa/Entity.java`
- `src/main/java/io/tutor/minijpa/Table.java`
- `src/main/java/io/tutor/minijpa/Id.java`
- `src/main/java/io/tutor/minijpa/Column.java`
