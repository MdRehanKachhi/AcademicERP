from django.core.validators import RegexValidator
from django.db import migrations, models


def _column_names(connection, table_name):
    with connection.cursor() as cursor:
        return {
            column.name
            for column in connection.introspection.get_table_description(cursor, table_name)
        }


def _constraint_names(connection, table_name):
    with connection.cursor() as cursor:
        return set(connection.introspection.get_constraints(cursor, table_name).keys())


def sync_student_registration_schema(apps, schema_editor):
    connection = schema_editor.connection
    table_name = "core_student"
    columns = _column_names(connection, table_name)

    # Handle column renames using database-agnostic SQL
    if "self_whatsapp_number" in columns and "student_whatsapp_number" not in columns:
        schema_editor.execute(
            f"ALTER TABLE {table_name} RENAME COLUMN self_whatsapp_number TO student_whatsapp_number"
        )
        columns.remove("self_whatsapp_number")
        columns.add("student_whatsapp_number")

    if "parents_whatsapp_number" in columns and "parent_whatsapp_number" not in columns:
        schema_editor.execute(
            f"ALTER TABLE {table_name} RENAME COLUMN parents_whatsapp_number TO parent_whatsapp_number"
        )
        columns.remove("parents_whatsapp_number")
        columns.add("parent_whatsapp_number")

    if "subcaste" in columns and "sub_caste" not in columns:
        schema_editor.execute(
            f"ALTER TABLE {table_name} RENAME COLUMN subcaste TO sub_caste"
        )
        columns.remove("subcaste")
        columns.add("sub_caste")

    # Column definitions - database-specific types
    db_backend = connection.vendor
    if db_backend == 'postgresql':
        column_definitions = {
            "abc_id": "VARCHAR(50) NULL",
            "address": "TEXT NULL",
            "caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "date_of_birth": "DATE NULL",
            "district": "VARCHAR(120) NOT NULL DEFAULT ''",
            "first_name": "VARCHAR(100) NOT NULL DEFAULT ''",
            "gender": "VARCHAR(20) NOT NULL DEFAULT ''",
            "last_name": "VARCHAR(100) NOT NULL DEFAULT ''",
            "middle_name": "VARCHAR(100) NOT NULL DEFAULT ''",
            "parent_whatsapp_number": "VARCHAR(10) NOT NULL DEFAULT ''",
            "pincode": "VARCHAR(6) NOT NULL DEFAULT ''",
            "student_whatsapp_number": "VARCHAR(10) NULL",
            "sub_caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "taluka": "VARCHAR(120) NOT NULL DEFAULT ''",
        }
        alter_column_sql = "ALTER COLUMN {column_name} TYPE {column_type}"
    elif db_backend == 'mysql':
        column_definitions = {
            "abc_id": "VARCHAR(50) NULL",
            "address": "LONGTEXT NULL",
            "caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "date_of_birth": "DATE NULL",
            "district": "VARCHAR(120) NOT NULL DEFAULT ''",
            "first_name": "VARCHAR(100) NOT NULL DEFAULT ''",
            "gender": "VARCHAR(20) NOT NULL DEFAULT ''",
            "last_name": "VARCHAR(100) NOT NULL DEFAULT ''",
            "middle_name": "VARCHAR(100) NOT NULL DEFAULT ''",
            "parent_whatsapp_number": "VARCHAR(10) NOT NULL DEFAULT ''",
            "pincode": "VARCHAR(6) NOT NULL DEFAULT ''",
            "student_whatsapp_number": "VARCHAR(10) NULL",
            "sub_caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "taluka": "VARCHAR(120) NOT NULL DEFAULT ''",
        }
        alter_column_sql = "MODIFY COLUMN {column_name} {column_type}"
    else:
        # Default to PostgreSQL syntax
        column_definitions = {
            "abc_id": "VARCHAR(50) NULL",
            "address": "TEXT NULL",
            "caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "date_of_birth": "DATE NULL",
            "district": "VARCHAR(120) NOT NULL DEFAULT ''",
            "first_name": "VARCHAR(100) NOT NULL DEFAULT ''",
            "gender": "VARCHAR(20) NOT NULL DEFAULT ''",
            "last_name": "VARCHAR(100) NOT NULL DEFAULT ''",
            "middle_name": "VARCHAR(100) NOT NULL DEFAULT ''",
            "parent_whatsapp_number": "VARCHAR(10) NOT NULL DEFAULT ''",
            "pincode": "VARCHAR(6) NOT NULL DEFAULT ''",
            "student_whatsapp_number": "VARCHAR(10) NULL",
            "sub_caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "taluka": "VARCHAR(120) NOT NULL DEFAULT ''",
        }
        alter_column_sql = "ALTER COLUMN {column_name} TYPE {column_type}"

    non_nullable_text_columns = {
        "caste",
        "district",
        "first_name",
        "gender",
        "last_name",
        "middle_name",
        "parent_whatsapp_number",
        "pincode",
        "sub_caste",
        "taluka",
    }

    for column_name, column_type in column_definitions.items():
        if column_name not in columns:
            schema_editor.execute(
                f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
            )
            columns.add(column_name)
        else:
            if column_name in non_nullable_text_columns:
                schema_editor.execute(
                    f"UPDATE {table_name} SET {column_name} = '' WHERE {column_name} IS NULL"
                )
            schema_editor.execute(
                f"ALTER TABLE {table_name} {alter_column_sql.format(column_name=column_name, column_type=column_type)}"
            )

    schema_editor.execute(
        f"UPDATE {table_name} SET student_whatsapp_number = NULL WHERE student_whatsapp_number = ''"
    )
    schema_editor.execute(
        f"UPDATE {table_name} SET abc_id = NULL WHERE abc_id = ''"
    )

    constraints = _constraint_names(connection, table_name)
    if "uniq_core_student_student_whatsapp_number" not in constraints:
        schema_editor.execute(
            f"ALTER TABLE {table_name} ADD CONSTRAINT uniq_core_student_student_whatsapp_number UNIQUE (student_whatsapp_number)"
        )

    constraints = _constraint_names(connection, table_name)
    if "uniq_core_student_abc_id" not in constraints:
        schema_editor.execute(
            f"ALTER TABLE {table_name} ADD CONSTRAINT uniq_core_student_abc_id UNIQUE (abc_id)"
        )


def split_existing_student_names(apps, schema_editor):
    Student = apps.get_model("core", "Student")

    for student in Student.objects.all():
        parts = (student.name or "").strip().split()

        if not student.first_name:
            student.first_name = parts[0] if parts else ""

        if not student.last_name:
            student.last_name = parts[-1] if len(parts) > 1 else student.first_name

        if not student.middle_name and len(parts) > 2:
            student.middle_name = " ".join(parts[1:-1])

        if not student.parent_whatsapp_number and student.parent_mobile:
            student.parent_whatsapp_number = "".join(
                ch for ch in str(student.parent_mobile) if ch.isdigit()
            )[:10]

        student.save(
            update_fields=[
                "first_name",
                "middle_name",
                "last_name",
                "parent_whatsapp_number",
            ]
        )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0007_realign_legacy_mysql_schema"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(sync_student_registration_schema, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="student",
                    name="abc_id",
                    field=models.CharField(blank=True, max_length=50, null=True, unique=True),
                ),
                migrations.AddField(
                    model_name="student",
                    name="address",
                    field=models.TextField(blank=True),
                ),
                migrations.AddField(
                    model_name="student",
                    name="caste",
                    field=models.CharField(blank=True, max_length=120),
                ),
                migrations.AddField(
                    model_name="student",
                    name="date_of_birth",
                    field=models.DateField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="student",
                    name="district",
                    field=models.CharField(blank=True, max_length=120),
                ),
                migrations.AddField(
                    model_name="student",
                    name="first_name",
                    field=models.CharField(default="", max_length=100),
                    preserve_default=False,
                ),
                migrations.AddField(
                    model_name="student",
                    name="gender",
                    field=models.CharField(
                        blank=True,
                        choices=[("Male", "Male"), ("Female", "Female"), ("Other", "Other")],
                        max_length=20,
                    ),
                ),
                migrations.AddField(
                    model_name="student",
                    name="last_name",
                    field=models.CharField(default="", max_length=100),
                    preserve_default=False,
                ),
                migrations.AddField(
                    model_name="student",
                    name="middle_name",
                    field=models.CharField(blank=True, max_length=100),
                ),
                migrations.AddField(
                    model_name="student",
                    name="parent_whatsapp_number",
                    field=models.CharField(
                        blank=True,
                        max_length=10,
                        validators=[
                            RegexValidator(
                                message="Phone number must be exactly 10 digits.",
                                regex="^\\d{10}$",
                            )
                        ],
                    ),
                ),
                migrations.AddField(
                    model_name="student",
                    name="pincode",
                    field=models.CharField(
                        blank=True,
                        max_length=6,
                        validators=[
                            RegexValidator(
                                message="Pincode must be exactly 6 digits.",
                                regex="^\\d{6}$",
                            )
                        ],
                    ),
                ),
                migrations.AddField(
                    model_name="student",
                    name="student_whatsapp_number",
                    field=models.CharField(
                        blank=True,
                        max_length=10,
                        null=True,
                        unique=True,
                        validators=[
                            RegexValidator(
                                message="Phone number must be exactly 10 digits.",
                                regex="^\\d{10}$",
                            )
                        ],
                    ),
                ),
                migrations.AddField(
                    model_name="student",
                    name="sub_caste",
                    field=models.CharField(blank=True, max_length=120),
                ),
                migrations.AddField(
                    model_name="student",
                    name="taluka",
                    field=models.CharField(blank=True, max_length=120),
                ),
            ],
        ),
        migrations.RunPython(split_existing_student_names, migrations.RunPython.noop),
    ]
