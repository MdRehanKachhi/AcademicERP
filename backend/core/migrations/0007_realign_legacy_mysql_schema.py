from django.db import migrations


def _column_names(connection, table_name):
    with connection.cursor() as cursor:
        return {
            column.name
            for column in connection.introspection.get_table_description(cursor, table_name)
        }


def realign_legacy_mysql_schema(apps, schema_editor):
    connection = schema_editor.connection

    if connection.vendor != "mysql":
        return

    student_columns = _column_names(connection, "core_student")
    faculty_columns = _column_names(connection, "core_faculty")

    with connection.cursor() as cursor:
        if "name" not in student_columns:
            cursor.execute(
                "ALTER TABLE core_student "
                "ADD COLUMN name VARCHAR(150) NOT NULL DEFAULT ''"
            )
            student_columns.add("name")

        if "parent_mobile" not in student_columns:
            cursor.execute(
                "ALTER TABLE core_student "
                "ADD COLUMN parent_mobile VARCHAR(20) NOT NULL DEFAULT ''"
            )
            student_columns.add("parent_mobile")

        if {"first_name", "middle_name", "last_name", "name"}.issubset(student_columns):
            cursor.execute(
                """
                UPDATE core_student
                SET name = TRIM(
                    CONCAT_WS(
                        ' ',
                        NULLIF(first_name, ''),
                        NULLIF(middle_name, ''),
                        NULLIF(last_name, '')
                    )
                )
                WHERE name = ''
                """
            )

        if {"parents_whatsapp_number", "parent_mobile"}.issubset(student_columns):
            cursor.execute(
                """
                UPDATE core_student
                SET parent_mobile = COALESCE(parents_whatsapp_number, '')
                WHERE parent_mobile = ''
                """
            )

        if "address" in student_columns:
            cursor.execute("ALTER TABLE core_student MODIFY COLUMN address LONGTEXT NULL")

        for column_name, length in (
            ("abc_id", 50),
            ("caste", 120),
            ("district", 120),
            ("middle_name", 100),
            ("pincode", 10),
            ("subcaste", 120),
            ("taluka", 120),
        ):
            if column_name in student_columns:
                cursor.execute(
                    f"ALTER TABLE core_student MODIFY COLUMN {column_name} "
                    f"VARCHAR({length}) NOT NULL DEFAULT ''"
                )

        if "name" not in faculty_columns:
            cursor.execute(
                "ALTER TABLE core_faculty "
                "ADD COLUMN name VARCHAR(150) NOT NULL DEFAULT ''"
            )
            faculty_columns.add("name")

        if {"first_name", "middle_name", "last_name", "name"}.issubset(faculty_columns):
            cursor.execute(
                """
                UPDATE core_faculty
                SET name = TRIM(
                    CONCAT_WS(
                        ' ',
                        NULLIF(first_name, ''),
                        NULLIF(middle_name, ''),
                        NULLIF(last_name, '')
                    )
                )
                WHERE name = ''
                """
            )

        if "address" in faculty_columns:
            cursor.execute("ALTER TABLE core_faculty MODIFY COLUMN address LONGTEXT NULL")

        for column_name, length in (
            ("district", 120),
            ("experience", 100),
            ("highest_education", 150),
            ("middle_name", 100),
            ("taluka", 120),
        ):
            if column_name in faculty_columns:
                cursor.execute(
                    f"ALTER TABLE core_faculty MODIFY COLUMN {column_name} "
                    f"VARCHAR({length}) NOT NULL DEFAULT ''"
                )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0006_alter_subjectassignment_unique_together_and_more"),
    ]

    operations = [
        migrations.RunPython(realign_legacy_mysql_schema, migrations.RunPython.noop),
    ]
