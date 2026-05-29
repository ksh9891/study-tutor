package tutortck.step02;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.EntityMetadataExtractor;
import io.tutor.minijpa.Id;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MissingEntityAnnotationTckTest {
    static class NotEntity {
        @Id
        @Column(name = "id")
        private Long id;
    }

    @Test
    void rejectsClassWithoutEntityAnnotation() {
        assertThatThrownBy(() -> new EntityMetadataExtractor().extract(NotEntity.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("@Entity");
    }
}
