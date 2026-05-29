package tutortck.step03;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.EntityMetadata;
import io.tutor.minijpa.EntityMetadataExtractor;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.SelectSqlGenerator;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SelectSqlGeneratorEdgeCaseTckTest {
    @Entity
    @Table(name = "orders")
    static class OrderEntity {
        @Column(name = "order_name")
        private String name;

        @Id
        @Column(name = "order_id")
        private Long id;
    }

    @Test
    void usesIdColumnInWhereClauseEvenWhenIdIsNotFirstField() {
        EntityMetadata metadata = new EntityMetadataExtractor().extract(OrderEntity.class);

        String sql = new SelectSqlGenerator().generateFindByIdSql(metadata);

        assertThat(sql).isEqualTo("select order_name, order_id from orders where order_id = ?");
    }
}
