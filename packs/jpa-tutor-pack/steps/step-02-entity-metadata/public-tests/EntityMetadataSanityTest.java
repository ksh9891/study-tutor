package publictests.step02;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.EntityMetadata;
import io.tutor.minijpa.EntityMetadataExtractor;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EntityMetadataSanityTest {
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
    void extractsTableIdAndColumns() {
        EntityMetadata metadata = new EntityMetadataExtractor().extract(Member.class);

        assertThat(metadata.tableName()).isEqualTo("members");
        assertThat(metadata.idColumn().fieldName()).isEqualTo("id");
        assertThat(metadata.idColumn().columnName()).isEqualTo("id");
        assertThat(metadata.columns()).extracting("columnName").containsExactly("id", "member_name");
    }
}
