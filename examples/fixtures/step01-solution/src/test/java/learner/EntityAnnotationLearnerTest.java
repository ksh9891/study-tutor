package learner;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EntityAnnotationLearnerTest {
    @Entity
    @Table(name = "members")
    static class Member {
        @Id
        @Column(name = "id")
        private Long id;
    }

    @Test
    void readsEntityMappingAnnotationsAtRuntime() throws Exception {
        assertThat(Member.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Member.class.getAnnotation(Table.class).name()).isEqualTo("members");
        assertThat(Member.class.getDeclaredField("id").isAnnotationPresent(Id.class)).isTrue();
        assertThat(Member.class.getDeclaredField("id").getAnnotation(Column.class).name()).isEqualTo("id");
    }
}
