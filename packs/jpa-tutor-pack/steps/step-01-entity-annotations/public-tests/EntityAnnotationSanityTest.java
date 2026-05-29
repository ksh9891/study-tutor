package publictests.step01;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

class EntityAnnotationSanityTest {
    @Entity
    @Table(name = "members")
    static class Member {
        @Id
        @Column(name = "id")
        private Long id;

        @Column(name = "member_name")
        private String name;
    }

    @Test
    void classAnnotationsAreReadableAtRuntime() {
        assertThat(Member.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Member.class.getAnnotation(Table.class).name()).isEqualTo("members");
    }

    @Test
    void fieldAnnotationsAreReadableAtRuntime() throws Exception {
        Field id = Member.class.getDeclaredField("id");
        Field name = Member.class.getDeclaredField("name");

        assertThat(id.isAnnotationPresent(Id.class)).isTrue();
        assertThat(id.getAnnotation(Column.class).name()).isEqualTo("id");
        assertThat(name.getAnnotation(Column.class).name()).isEqualTo("member_name");
    }
}
