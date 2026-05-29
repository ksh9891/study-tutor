package tutortck.step01;

import io.tutor.minijpa.Column;
import io.tutor.minijpa.Entity;
import io.tutor.minijpa.Id;
import io.tutor.minijpa.Table;
import org.junit.jupiter.api.Test;

import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.TYPE;
import static org.assertj.core.api.Assertions.assertThat;

class EntityAnnotationTargetPolicyTckTest {
    @Test
    void entityAndTableMustTargetTypes() {
        assertThat(Entity.class.getAnnotation(Target.class).value()).containsExactly(TYPE);
        assertThat(Table.class.getAnnotation(Target.class).value()).containsExactly(TYPE);
    }

    @Test
    void idAndColumnMustTargetFields() {
        assertThat(Id.class.getAnnotation(Target.class).value()).containsExactly(FIELD);
        assertThat(Column.class.getAnnotation(Target.class).value()).containsExactly(FIELD);
    }
}
