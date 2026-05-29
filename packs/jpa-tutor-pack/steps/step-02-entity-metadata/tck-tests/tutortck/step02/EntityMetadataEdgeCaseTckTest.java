package tutortck.step02;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.EntityMetadataExtractor;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EntityMetadataEdgeCaseTckTest {
    static class NotEntity {
        @Id
        @Column(name = "id")
        private Long id;
    }

    @Entity
    @Table(name = "no_id_members")
    static class EntityWithoutId {
        @Column(name = "name")
        private String name;
    }

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
    void rejectsClassWithoutEntityAnnotation() {
        assertThatThrownBy(() -> new EntityMetadataExtractor().extract(NotEntity.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("@Entity");
    }

    @Test
    void rejectsEntityWithoutId() {
        assertThatThrownBy(() -> new EntityMetadataExtractor().extract(EntityWithoutId.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("@Id");
    }

    @Test
    void rejectsEntityWithDuplicateIds() {
        assertThatThrownBy(() -> new EntityMetadataExtractor().extract(EntityWithDuplicateIds.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("@Id");
    }
}
