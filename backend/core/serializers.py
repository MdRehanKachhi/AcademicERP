from rest_framework import serializers

from .models import (
    AcademicClass,
    Assignment,
    Faculty,
    LeaveApplication,
    Mark,
    StaffAttendance,
    Student,
    StudentAttendance,
    Submission,
    Subject,
    SubjectAssignment,
)


class AcademicClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicClass
        fields = ["id", "class_name"]


class StudentSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)
    academic_class_name = serializers.CharField(source="academic_class.class_name", read_only=True)

    class Meta:
        model = Student
        fields = [
            "id",
            "name",
            "first_name",
            "middle_name",
            "last_name",
            "email",
            "date_of_birth",
            "gender",
            "student_whatsapp_number",
            "parent_whatsapp_number",
            "parent_mobile",
            "caste",
            "sub_caste",
            "address",
            "district",
            "taluka",
            "pincode",
            "abc_id",
            "academic_class",
            "academic_class_name",
            "status",
            "roll",
        ]
        extra_kwargs = {
            "parent_mobile": {"read_only": True},
            "status": {"required": False},
            "roll": {"required": False},
        }

    def validate_email(self, value):
        normalized_email = (value or "").strip().lower()
        queryset = Student.objects.filter(email__iexact=normalized_email)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A student with this email already exists.")
        return normalized_email

    def validate_student_whatsapp_number(self, value):
        normalized_value = "".join(filter(str.isdigit, str(value or "")))
        queryset = Student.objects.filter(student_whatsapp_number=normalized_value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A student with this WhatsApp number already exists.")
        return normalized_value

    def validate_parent_whatsapp_number(self, value):
        return "".join(filter(str.isdigit, str(value or "")))

    def validate_pincode(self, value):
        return "".join(filter(str.isdigit, str(value or "")))

    def validate_abc_id(self, value):
        normalized_value = (value or "").strip() or None
        if not normalized_value:
            return None

        queryset = Student.objects.filter(abc_id__iexact=normalized_value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A student with this ABC ID already exists.")
        return normalized_value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        required_fields = {
            "first_name": "First name",
            "last_name": "Last name",
            "date_of_birth": "Date of birth",
            "gender": "Gender",
            "student_whatsapp_number": "Student WhatsApp number",
            "parent_whatsapp_number": "Parent WhatsApp number",
            "address": "Address",
            "district": "District",
            "taluka": "Taluka",
            "pincode": "Pincode",
            "academic_class": "Class",
        }

        errors = {}
        for field_name, label in required_fields.items():
            value = attrs.get(field_name, getattr(self.instance, field_name, None) if self.instance else None)
            if value in (None, ""):
                errors[field_name] = f"{label} is required."

        if errors:
            raise serializers.ValidationError(errors)

        attrs["parent_mobile"] = attrs.get(
            "parent_whatsapp_number",
            getattr(self.instance, "parent_whatsapp_number", ""),
        )
        return attrs


class FacultySerializer(serializers.ModelSerializer):
    class Meta:
        model = Faculty
        fields = [
            "id",
            "name",
            "email",
            "mobile_number",
            "qualification",
            "experience",
            "caste",
            "sub_caste",
            "address",
            "district",
            "taluka",
        ]

    def validate_email(self, value):
        normalized_email = (value or "").strip().lower()
        queryset = Faculty.objects.filter(email__iexact=normalized_email)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A faculty member with this email already exists.")
        return normalized_email

    def validate_mobile_number(self, value):
        normalized_value = "".join(filter(str.isdigit, str(value or "")))
        queryset = Faculty.objects.filter(mobile_number=normalized_value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A faculty member with this mobile number already exists.")
        return normalized_value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        required_fields = {
            "name": "Name",
            "email": "Email",
            "mobile_number": "Mobile number",
            "experience": "Experience",
            "address": "Address",
            "district": "District",
            "taluka": "Taluka",
        }

        errors = {}
        for field_name, label in required_fields.items():
            value = attrs.get(field_name, getattr(self.instance, field_name, None) if self.instance else None)
            if value in (None, ""):
                errors[field_name] = f"{label} is required."

        experience = attrs.get("experience", getattr(self.instance, "experience", None) if self.instance else None)
        if experience is not None and int(experience) <= 0:
            errors["experience"] = "Experience must be greater than 0."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs


class SubjectSerializer(serializers.ModelSerializer):
    academic_class_name = serializers.CharField(source="academic_class.class_name", read_only=True)

    class Meta:
        model = Subject
        fields = [
            "id",
            "name",
            "code",
            "academic_class",
            "academic_class_name",
        ]


class SubjectAssignmentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="academic_class.class_name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    faculty_name = serializers.CharField(source="faculty.name", read_only=True)
    faculty_email = serializers.CharField(source="faculty.email", read_only=True)

    class Meta:
        model = SubjectAssignment
        fields = [
            "id",
            "academic_class",
            "class_name",
            "subject",
            "subject_name",
            "faculty",
            "faculty_name",
            "faculty_email",
            "weekly_timetable",
        ]

    def validate(self, attrs):
        academic_class = attrs.get("academic_class", getattr(self.instance, "academic_class", None))
        subject = attrs.get("subject", getattr(self.instance, "subject", None))

        if academic_class and subject and subject.academic_class_id != academic_class.id:
            raise serializers.ValidationError(
                {"subject": "Selected subject does not belong to the selected class."}
            )

        if subject:
            queryset = SubjectAssignment.objects.filter(subject=subject)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"subject": "This subject is already assigned to another faculty."}
                )

        return attrs


class LeaveApplicationSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    faculty_name = serializers.CharField(source="faculty.name", read_only=True)

    class Meta:
        model = LeaveApplication
        fields = [
            "id",
            "leave_type",
            "student",
            "student_name",
            "faculty",
            "faculty_name",
            "from_date",
            "to_date",
            "reason",
            "status",
        ]

    def validate(self, attrs):
        leave_type = attrs.get("leave_type", getattr(self.instance, "leave_type", None))
        student = attrs.get("student", getattr(self.instance, "student", None))
        faculty = attrs.get("faculty", getattr(self.instance, "faculty", None))
        from_date = attrs.get("from_date", getattr(self.instance, "from_date", None))
        to_date = attrs.get("to_date", getattr(self.instance, "to_date", None))

        if leave_type == "student" and not student:
            raise serializers.ValidationError({"student": "Student leave requires a student record."})

        if leave_type == "faculty" and not faculty:
            raise serializers.ValidationError({"faculty": "Faculty leave requires a faculty record."})

        if leave_type == "student" and faculty:
            raise serializers.ValidationError({"faculty": "Student leave cannot reference a faculty record."})

        if leave_type == "faculty" and student:
            raise serializers.ValidationError({"student": "Faculty leave cannot reference a student record."})

        if from_date and to_date and from_date > to_date:
            raise serializers.ValidationError({"to_date": "To date must be on or after from date."})

        return attrs


class MarkSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    class_name = serializers.CharField(source="academic_class.class_name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = Mark
        fields = [
            "id",
            "student",
            "student_name",
            "academic_class",
            "class_name",
            "subject",
            "subject_name",
            "exam_type",
            "marks",
        ]

    def validate_marks(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Marks must be between 0 and 100.")

        return value


class StudentAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = StudentAttendance
        fields = ["id", "student", "student_name", "subject", "subject_name", "date", "status"]

    def validate(self, attrs):
        student = attrs.get("student", getattr(self.instance, "student", None))
        date = attrs.get("date", getattr(self.instance, "date", None))

        subject = attrs.get("subject", getattr(self.instance, "subject", None))

        if student and date:
            queryset = StudentAttendance.objects.filter(student=student, subject=subject, date=date)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError("Attendance for this student, subject and date already exists.")

        return attrs


class AssignmentSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = Assignment
        fields = ["id", "subject", "subject_name", "title", "due_date", "description"]


class SubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id",
            "student",
            "student_name",
            "assignment",
            "assignment_title",
            "submitted",
            "marks",
            "submitted_at",
        ]


class StaffAttendanceSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source="faculty.name", read_only=True)
    faculty_email = serializers.CharField(source="faculty.email", read_only=True)

    class Meta:
        model = StaffAttendance
        fields = ["id", "faculty", "faculty_name", "faculty_email", "date", "status"]

    def validate(self, attrs):
        faculty = attrs.get("faculty", getattr(self.instance, "faculty", None))
        date = attrs.get("date", getattr(self.instance, "date", None))

        if faculty and date:
            queryset = StaffAttendance.objects.filter(faculty=faculty, date=date)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError("Attendance for this faculty member and date already exists.")

        return attrs
