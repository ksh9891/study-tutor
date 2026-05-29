package tutortck.step02;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.EntityMetadataExtractor;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DuplicateIdFieldsTckTest {
    @Entity
    @Table(name = "duplicate_id_members")
    static class EntityWithDuplicateIds {
        @Id
        @Column(name = "id")
        private Long id;

        @Id
        @Column(name = "legacy_id")
        private Long legacyId;
    }

    @Test
    void rejectsEntityWithDuplicateIds() {
        assertThatThrownBy(() -> new EntityMetadataExtractor().extract(EntityWithDuplicateIds.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("@Id");
    }
}
