import re

from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models


class AcademicClass(models.Model):
    class_name = models.CharField(max_length=120, unique=True)

    class Meta:
        ordering = ["class_name"]

    def __str__(self):
        return self.class_name


class Student(models.Model):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Approved", "Approved"),
        ("Rejected", "Rejected"),
    ]
    GENDER_CHOICES = [
        ("Male", "Male"),
        ("Female", "Female"),
        ("Other", "Other"),
    ]

    PHONE_VALIDATOR = RegexValidator(
        regex=r"^\d{10}$",
        message="Phone number must be exactly 10 digits.",
    )
    PINCODE_VALIDATOR = RegexValidator(
        regex=r"^\d{6}$",
        message="Pincode must be exactly 6 digits.",
    )

    name = models.CharField(max_length=150)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    parent_mobile = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, blank=True)
    student_whatsapp_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        validators=[PHONE_VALIDATOR],
    )
    parent_whatsapp_number = models.CharField(
        max_length=10,
        blank=True,
        validators=[PHONE_VALIDATOR],
    )
    caste = models.CharField(max_length=120, blank=True)
    sub_caste = models.CharField(max_length=120, blank=True)
    address = models.TextField(blank=True)
    district = models.CharField(max_length=120, blank=True)
    taluka = models.CharField(max_length=120, blank=True)
    pincode = models.CharField(max_length=6, blank=True, validators=[PINCODE_VALIDATOR])
    abc_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    academic_class = models.ForeignKey(
        AcademicClass,
        on_delete=models.SET_NULL,
        related_name="students",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    roll = models.CharField(max_length=30, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def sync_derived_fields(self):
        self.first_name = (self.first_name or "").strip()
        self.middle_name = (self.middle_name or "").strip()
        self.last_name = (self.last_name or "").strip()
        self.email = (self.email or "").strip().lower()
        self.student_whatsapp_number = re.sub(r"\D", "", self.student_whatsapp_number or "")
        self.parent_whatsapp_number = re.sub(r"\D", "", self.parent_whatsapp_number or "")
        self.parent_mobile = re.sub(r"\D", "", self.parent_mobile or self.parent_whatsapp_number or "")
        self.pincode = re.sub(r"\D", "", self.pincode or "")
        self.caste = (self.caste or "").strip()
        self.sub_caste = (self.sub_caste or "").strip()
        self.address = (self.address or "").strip()
        self.district = (self.district or "").strip()
        self.taluka = (self.taluka or "").strip()
        self.gender = (self.gender or "").strip()
        self.abc_id = (self.abc_id or "").strip() or None
        self.name = " ".join(
            part for part in [self.first_name, self.middle_name, self.last_name] if part
        )

    def clean(self):
        errors = {}
        self.sync_derived_fields()

        required_labels = {
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

        for field_name, label in required_labels.items():
            value = getattr(self, field_name, None)
            if value in (None, ""):
                errors[field_name] = f"{label} is required."

        if self.email:
            existing_email = Student.objects.filter(email__iexact=self.email)
            if self.pk:
                existing_email = existing_email.exclude(pk=self.pk)
            if existing_email.exists():
                errors["email"] = "A student with this email already exists."

        if self.student_whatsapp_number:
            existing_student_phone = Student.objects.filter(
                student_whatsapp_number=self.student_whatsapp_number
            )
            if self.pk:
                existing_student_phone = existing_student_phone.exclude(pk=self.pk)
            if existing_student_phone.exists():
                errors["student_whatsapp_number"] = (
                    "A student with this WhatsApp number already exists."
                )

        if self.abc_id:
            existing_abc_id = Student.objects.filter(abc_id__iexact=self.abc_id)
            if self.pk:
                existing_abc_id = existing_abc_id.exclude(pk=self.pk)
            if existing_abc_id.exists():
                errors["abc_id"] = "A student with this ABC ID already exists."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.status == "Approved" and not self.roll and self.academic_class:
            # Generate roll number for this class
            max_roll = Student.objects.filter(
                academic_class=self.academic_class,
                status="Approved"
            ).aggregate(models.Max('roll'))['roll__max']
            
            if max_roll:
                # Extract the number part
                match = str(max_roll).split('-')[-1]
                try:
                    next_num = int(match) + 1
                except ValueError:
                    next_num = 1
            else:
                next_num = 1
            
            self.roll = f"22-0-26-{str(next_num).zfill(3)}"

        self.sync_derived_fields()
        self.full_clean()
        super().save(*args, **kwargs)


class Faculty(models.Model):
    PHONE_VALIDATOR = RegexValidator(
        regex=r"^\d{10}$",
        message="Mobile number must be exactly 10 digits.",
    )

    name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    mobile_number = models.CharField(max_length=10, unique=True, validators=[PHONE_VALIDATOR])
    qualification = models.CharField(max_length=150, blank=True)
    experience = models.PositiveIntegerField()
    caste = models.CharField(max_length=120, blank=True)
    sub_caste = models.CharField(max_length=120, blank=True)
    address = models.TextField(blank=True)
    district = models.CharField(max_length=120, blank=True)
    taluka = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def sync_derived_fields(self):
        self.name = (self.name or "").strip()
        self.email = (self.email or "").strip().lower()
        self.mobile_number = re.sub(r"\D", "", self.mobile_number or "")
        self.qualification = (self.qualification or "").strip()
        self.caste = (self.caste or "").strip()
        self.sub_caste = (self.sub_caste or "").strip()
        self.address = (self.address or "").strip()
        self.district = (self.district or "").strip()
        self.taluka = (self.taluka or "").strip()

    def clean(self):
        errors = {}
        self.sync_derived_fields()

        required_labels = {
            "name": "Name",
            "email": "Email",
            "mobile_number": "Mobile number",
            "experience": "Experience",
            "address": "Address",
            "district": "District",
            "taluka": "Taluka",
        }

        for field_name, label in required_labels.items():
            value = getattr(self, field_name, None)
            if value in (None, ""):
                errors[field_name] = f"{label} is required."

        if self.email:
            existing_email = Faculty.objects.filter(email__iexact=self.email)
            if self.pk:
                existing_email = existing_email.exclude(pk=self.pk)
            if existing_email.exists():
                errors["email"] = "A faculty member with this email already exists."

        if self.mobile_number:
            existing_mobile = Faculty.objects.filter(mobile_number=self.mobile_number)
            if self.pk:
                existing_mobile = existing_mobile.exclude(pk=self.pk)
            if existing_mobile.exists():
                errors["mobile_number"] = "A faculty member with this mobile number already exists."

        if self.experience is not None and int(self.experience) <= 0:
            errors["experience"] = "Experience must be greater than 0."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.sync_derived_fields()
        self.full_clean()
        return super().save(*args, **kwargs)


class Subject(models.Model):
    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=30, blank=True)
    academic_class = models.ForeignKey(
        AcademicClass,
        on_delete=models.SET_NULL,
        related_name="subjects",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SubjectAssignment(models.Model):
    academic_class = models.ForeignKey(
        AcademicClass,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    subject = models.OneToOneField(
        Subject,
        on_delete=models.CASCADE,
        related_name="assignment",
    )
    faculty = models.ForeignKey(
        Faculty,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    weekly_timetable = models.JSONField(default=list, blank=True)

    class Meta:
        unique_together = ("academic_class", "subject", "faculty")
        ordering = ["academic_class__class_name", "subject__name"]

    def __str__(self):
        return f"{self.academic_class} - {self.subject}"

    def clean(self):
        if self.subject_id and self.academic_class_id:
            if self.subject.academic_class_id != self.academic_class_id:
                raise ValidationError(
                    {"subject": "Selected subject does not belong to the selected class."}
                )

        if self.subject_id:
            existing = SubjectAssignment.objects.filter(subject_id=self.subject_id)
            if self.pk:
                existing = existing.exclude(pk=self.pk)
            if existing.exists():
                raise ValidationError(
                    {"subject": "This subject is already assigned to another faculty."}
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class LeaveApplication(models.Model):
    TYPE_CHOICES = [
        ("student", "Student"),
        ("faculty", "Faculty"),
    ]
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Approved", "Approved"),
        ("Rejected", "Rejected"),
    ]

    leave_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="leave_applications",
        null=True,
        blank=True,
    )
    faculty = models.ForeignKey(
        Faculty,
        on_delete=models.CASCADE,
        related_name="leave_applications",
        null=True,
        blank=True,
    )
    from_date = models.DateField()
    to_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")

    class Meta:
        ordering = ["-from_date"]

    def __str__(self):
        return f"{self.leave_type} leave ({self.status})"


class Mark(models.Model):
    EXAM_CHOICES = [
        ("Class Test", "Class Test"),
        ("Mid Exam", "Mid Exam"),
        ("Assignment", "Assignment"),
        ("Internal", "Internal"),
        ("Midterm", "Midterm"),
        ("Final", "Final"),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="marks")
    academic_class = models.ForeignKey(AcademicClass, on_delete=models.CASCADE, related_name="marks")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="marks")
    exam_type = models.CharField(max_length=30, choices=EXAM_CHOICES)
    marks = models.PositiveIntegerField()

    class Meta:
        ordering = ["student__name", "subject__name"]

    def __str__(self):
        return f"{self.student} - {self.subject} - {self.marks}"


class StudentAttendance(models.Model):
    STATUS_CHOICES = [
        ("Present", "Present"),
        ("Absent", "Absent"),
        ("ML", "ML"),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_records")
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="attendance_records",
        null=True,
        blank=True,
    )
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)

    class Meta:
        unique_together = ("student", "subject", "date")
        ordering = ["-date", "student__name"]


class Assignment(models.Model):
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="assignments_list",
    )
    title = models.CharField(max_length=150)
    due_date = models.DateField()
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["due_date", "title"]
        unique_together = ("subject", "title", "due_date")

    def __str__(self):
        return f"{self.subject} - {self.title}"


class Submission(models.Model):
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    submitted = models.BooleanField(default=False)
    marks = models.PositiveIntegerField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["assignment__due_date", "student__name"]
        unique_together = ("student", "assignment")

    def __str__(self):
        return f"{self.student} - {self.assignment}"


class StaffAttendance(models.Model):
    STATUS_CHOICES = [
        ("Present", "Present"),
        ("Absent", "Absent"),
        ("ML", "ML"),
    ]

    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name="attendance_records")
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)

    class Meta:
        unique_together = ("faculty", "date")
        ordering = ["-date", "faculty__name"]
