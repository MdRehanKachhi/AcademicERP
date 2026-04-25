from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="AcademicClass",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("class_name", models.CharField(max_length=120, unique=True)),
            ],
            options={"ordering": ["class_name"]},
        ),
        migrations.CreateModel(
            name="Faculty",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=150)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("department", models.CharField(blank=True, max_length=120)),
                ("mobile", models.CharField(blank=True, max_length=20)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Subject",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120, unique=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Student",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=150)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("parent_mobile", models.CharField(blank=True, max_length=20)),
                ("status", models.CharField(choices=[("Pending", "Pending"), ("Approved", "Approved"), ("Rejected", "Rejected")], default="Pending", max_length=20)),
                ("roll", models.CharField(blank=True, max_length=30)),
                ("academic_class", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="students", to="core.academicclass")),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="StaffAttendance",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("date", models.DateField()),
                ("status", models.CharField(choices=[("Present", "Present"), ("Absent", "Absent"), ("ML", "ML")], max_length=20)),
                ("faculty", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attendance_records", to="core.faculty")),
            ],
            options={"ordering": ["-date", "faculty__name"]},
        ),
        migrations.CreateModel(
            name="StudentAttendance",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("date", models.DateField()),
                ("status", models.CharField(choices=[("Present", "Present"), ("Absent", "Absent"), ("ML", "ML")], max_length=20)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attendance_records", to="core.student")),
            ],
            options={"ordering": ["-date", "student__name"]},
        ),
        migrations.CreateModel(
            name="SubjectAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("weekly_timetable", models.JSONField(blank=True, default=list)),
                ("academic_class", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assignments", to="core.academicclass")),
                ("faculty", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assignments", to="core.faculty")),
                ("subject", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assignments", to="core.subject")),
            ],
            options={"ordering": ["academic_class__class_name", "subject__name"]},
        ),
        migrations.CreateModel(
            name="Mark",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("exam_type", models.CharField(choices=[("Internal", "Internal"), ("Midterm", "Midterm"), ("Final", "Final")], max_length=30)),
                ("marks", models.PositiveIntegerField()),
                ("academic_class", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="marks", to="core.academicclass")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="marks", to="core.student")),
                ("subject", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="marks", to="core.subject")),
            ],
            options={"ordering": ["student__name", "subject__name"]},
        ),
        migrations.CreateModel(
            name="LeaveApplication",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("leave_type", models.CharField(choices=[("student", "Student"), ("faculty", "Faculty")], max_length=20)),
                ("from_date", models.DateField()),
                ("to_date", models.DateField()),
                ("reason", models.TextField()),
                ("status", models.CharField(choices=[("Pending", "Pending"), ("Approved", "Approved"), ("Rejected", "Rejected")], default="Pending", max_length=20)),
                ("faculty", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="leave_applications", to="core.faculty")),
                ("student", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="leave_applications", to="core.student")),
            ],
            options={"ordering": ["-from_date"]},
        ),
        migrations.AlterUniqueTogether(name="studentattendance", unique_together={("student", "date")}),
        migrations.AlterUniqueTogether(name="staffattendance", unique_together={("faculty", "date")}),
        migrations.AlterUniqueTogether(name="subjectassignment", unique_together={("academic_class", "subject", "faculty")}),
    ]
