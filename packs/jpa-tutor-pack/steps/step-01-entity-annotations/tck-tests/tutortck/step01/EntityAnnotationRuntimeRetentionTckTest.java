package tutortck.step01;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;

import static org.assertj.core.api.Assertions.assertThat;

class EntityAnnotationRuntimeRetentionTckTest {
    @Test
    void allAnnotationsMustUseRuntimeRetention() {
        assertThat(Entity.class.getAnnotation(Retention.class).value()).isEqualTo(RetentionPolicy.RUNTIME);
        assertThat(Table.class.getAnnotation(Retention.class).value()).isEqualTo(RetentionPolicy.RUNTIME);
        assertThat(Id.class.getAnnotation(Retention.class).value()).isEqualTo(RetentionPolicy.RUNTIME);
        assertThat(Column.class.getAnnotation(Retention.class).value()).isEqualTo(RetentionPolicy.RUNTIME);
    }
}
