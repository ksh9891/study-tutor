package tutortck.step02;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.EntityMetadataExtractor;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MissingIdFieldTckTest {
    @Entity
    @Table(name = "no_id_members")
    static class EntityWithoutId {
        @Column(name = "name")
        private String name;
    }

    @Test
    void rejectsEntityWithoutId() {
        assertThatThrownBy(() -> new EntityMetadataExtractor().extract(EntityWithoutId.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("@Id");
    }
}
