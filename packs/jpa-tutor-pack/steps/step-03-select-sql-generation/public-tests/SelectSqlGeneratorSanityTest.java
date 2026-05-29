package publictests.step03;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.EntityMetadata;
import io.tutor.minijpa.EntityMetadataExtractor;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.SelectSqlGenerator;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SelectSqlGeneratorSanityTest {
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
    void generatesFindByIdSqlFromMetadata() {
        EntityMetadata metadata = new EntityMetadataExtractor().extract(Member.class);

        String sql = new SelectSqlGenerator().generateFindByIdSql(metadata);

        assertThat(sql).isEqualTo("select id, member_name from members where id = ?");
    }
}
