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


def sync_faculty_profile_schema(apps, schema_editor):
    connection = schema_editor.connection
    table_name = "core_faculty"
    columns = _column_names(connection, table_name)

    # Handle column renames using database-agnostic SQL
    if "whatsapp_number" in columns and "mobile_number" not in columns:
        schema_editor.execute(
            f"ALTER TABLE {table_name} RENAME COLUMN whatsapp_number TO mobile_number"
        )
        columns.remove("whatsapp_number")
        columns.add("mobile_number")

    if "highest_education" in columns and "qualification" not in columns:
        schema_editor.execute(
            f"ALTER TABLE {table_name} RENAME COLUMN highest_education TO qualification"
        )
        columns.remove("highest_education")
        columns.add("qualification")

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
            "mobile_number": "VARCHAR(10) NOT NULL DEFAULT ''",
            "qualification": "VARCHAR(150) NOT NULL DEFAULT ''",
            "experience": "INTEGER NOT NULL DEFAULT 0",
            "caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "sub_caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "address": "TEXT NULL",
            "district": "VARCHAR(120) NOT NULL DEFAULT ''",
            "taluka": "VARCHAR(120) NOT NULL DEFAULT ''",
        }
        alter_column_sql = "ALTER COLUMN {column_name} TYPE {column_type}"
    elif db_backend == 'mysql':
        column_definitions = {
            "mobile_number": "VARCHAR(10) NOT NULL DEFAULT ''",
            "qualification": "VARCHAR(150) NOT NULL DEFAULT ''",
            "experience": "INT NOT NULL DEFAULT 0",
            "caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "sub_caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "address": "LONGTEXT NULL",
            "district": "VARCHAR(120) NOT NULL DEFAULT ''",
            "taluka": "VARCHAR(120) NOT NULL DEFAULT ''",
        }
        alter_column_sql = "MODIFY COLUMN {column_name} {column_type}"
    else:
        # Default to PostgreSQL syntax
        column_definitions = {
            "mobile_number": "VARCHAR(10) NOT NULL DEFAULT ''",
            "qualification": "VARCHAR(150) NOT NULL DEFAULT ''",
            "experience": "INTEGER NOT NULL DEFAULT 0",
            "caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "sub_caste": "VARCHAR(120) NOT NULL DEFAULT ''",
            "address": "TEXT NULL",
            "district": "VARCHAR(120) NOT NULL DEFAULT ''",
            "taluka": "VARCHAR(120) NOT NULL DEFAULT ''",
        }
        alter_column_sql = "ALTER COLUMN {column_name} TYPE {column_type}"

    non_nullable_text_columns = {
        "qualification",
        "caste",
        "sub_caste",
        "district",
        "taluka",
    }

    for column_name, column_type in column_definitions.items():
        if column_name not in columns:
            schema_editor.execute(
                f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
            )
            columns.add(column_name)
        else:
            if column_name == "mobile_number":
                # Generate mobile numbers for existing records
                if db_backend == 'postgresql':
                    schema_editor.execute(
                        f"""
                        UPDATE {table_name}
                        SET mobile_number = '9' || LPAD(CAST(id AS TEXT), 9, '0')
                        WHERE mobile_number IS NULL OR TRIM(mobile_number) = ''
                        """
                    )
                elif db_backend == 'mysql':
                    schema_editor.execute(
                        f"""
                        UPDATE {table_name}
                        SET mobile_number = CONCAT('9', LPAD(id, 9, '0'))
                        WHERE mobile_number IS NULL OR TRIM(mobile_number) = ''
                        """
                    )
            if column_name in non_nullable_text_columns:
                schema_editor.execute(
                    f"UPDATE {table_name} SET {column_name} = '' WHERE {column_name} IS NULL"
                )
            if column_name == "experience":
                if db_backend == 'postgresql':
                    schema_editor.execute(
                        f"""
                        UPDATE {table_name}
                        SET experience = 0
                        WHERE experience IS NULL
                           OR TRIM(CAST(experience AS TEXT)) = ''
                           OR CAST(experience AS TEXT) !~ '^[0-9]+$'
                        """
                    )
                elif db_backend == 'mysql':
                    schema_editor.execute(
                        f"""
                        UPDATE {table_name}
                        SET experience = 0
                        WHERE experience IS NULL
                           OR TRIM(CAST(experience AS CHAR)) = ''
                           OR CAST(experience AS CHAR) REGEXP '[^0-9]'
                        """
                    )
            schema_editor.execute(
                f"ALTER TABLE {table_name} {alter_column_sql.format(column_name=column_name, column_type=column_type)}"
            )

    # Final cleanup for mobile_number
    if db_backend == 'postgresql':
        schema_editor.execute(
            f"""
            UPDATE {table_name}
            SET mobile_number = '9' || LPAD(CAST(id AS TEXT), 9, '0')
            WHERE mobile_number IS NULL OR TRIM(mobile_number) = ''
            """
        )
    elif db_backend == 'mysql':
        schema_editor.execute(
            f"""
            UPDATE {table_name}
            SET mobile_number = CONCAT('9', LPAD(id, 9, '0'))
            WHERE mobile_number IS NULL OR TRIM(mobile_number) = ''
            """
        )

    # Final cleanup for experience
    if db_backend == 'postgresql':
        schema_editor.execute(
            f"""
            UPDATE {table_name}
            SET experience = 0
            WHERE experience IS NULL
               OR TRIM(CAST(experience AS TEXT)) = ''
               OR CAST(experience AS TEXT) !~ '^[0-9]+$'
            """
        )
    elif db_backend == 'mysql':
        schema_editor.execute(
            f"""
            UPDATE {table_name}
            SET experience = 0
            WHERE experience IS NULL
               OR TRIM(CAST(experience AS CHAR)) = ''
               OR CAST(experience AS CHAR) REGEXP '[^0-9]'
            """
        )

    constraints = _constraint_names(connection, table_name)
    if "uniq_core_faculty_mobile_number" not in constraints:
        schema_editor.execute(
            f"ALTER TABLE {table_name} ADD CONSTRAINT uniq_core_faculty_mobile_number UNIQUE (mobile_number)"
        )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0008_extend_student_registration_fields"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(sync_faculty_profile_schema, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="faculty",
                    name="mobile_number",
                    field=models.CharField(
                        default="",
                        max_length=10,
                        unique=True,
                        validators=[
                            RegexValidator(
                                message="Mobile number must be exactly 10 digits.",
                                regex="^\\d{10}$",
                            )
                        ],
                    ),
                    preserve_default=False,
                ),
                migrations.AddField(
                    model_name="faculty",
                    name="qualification",
                    field=models.CharField(blank=True, max_length=150),
                ),
                migrations.AddField(
                    model_name="faculty",
                    name="experience",
                    field=models.PositiveIntegerField(),
                ),
                migrations.AddField(
                    model_name="faculty",
                    name="caste",
                    field=models.CharField(blank=True, max_length=120),
                ),
                migrations.AddField(
                    model_name="faculty",
                    name="sub_caste",
                    field=models.CharField(blank=True, max_length=120),
                ),
                migrations.AddField(
                    model_name="faculty",
                    name="address",
                    field=models.TextField(blank=True),
                ),
                migrations.AddField(
                    model_name="faculty",
                    name="district",
                    field=models.CharField(blank=True, max_length=120),
                ),
                migrations.AddField(
                    model_name="faculty",
                    name="taluka",
                    field=models.CharField(blank=True, max_length=120),
                ),
            ],
        ),
    ]
