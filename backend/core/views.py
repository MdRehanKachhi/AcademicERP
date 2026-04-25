from django.db.models import Prefetch
from django.shortcuts import render
from rest_framework.exceptions import ValidationError
from rest_framework import filters, status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .forms import FacultyForm, StudentRegistrationForm, SubjectAssignmentForm
from .models import (
    AcademicClass,
    Assignment,
    Faculty,
    LeaveApplication,
    Mark,
    StaffAttendance,
    Student,
    StudentAttendance,
    Subject,
    SubjectAssignment,
    Submission,
)
from .serializers import (
    AcademicClassSerializer,
    AssignmentSerializer,
    FacultySerializer,
    LeaveApplicationSerializer,
    MarkSerializer,
    StaffAttendanceSerializer,
    StudentAttendanceSerializer,
    StudentSerializer,
    SubjectAssignmentSerializer,
    SubjectSerializer,
    SubmissionSerializer,
)


def get_logged_in_student(request):
    """
    The current frontend stores the active student session in localStorage,
    so the API reads the student email from a lightweight request header.
    """
    student_email = (request.headers.get("X-Student-Email") or "").strip().lower()
    if not student_email:
        return None

    return (
        Student.objects.select_related("academic_class")
        .filter(email__iexact=student_email, status="Approved")
        .first()
    )


def get_assigned_faculty_name(subject):
    try:
        return subject.assignment.faculty.name if subject.assignment.faculty else ""
    except SubjectAssignment.DoesNotExist:
        return ""


@api_view(["GET"])
def health_check(_request):
    return Response({"status": "ok", "message": "Academic ERP backend is running."})


@api_view(["GET"])
def class_subject_assignments(request):
    class_id = request.query_params.get("class_id")
    if class_id:
        subjects = (
            Subject.objects.filter(academic_class_id=class_id)
            .select_related("academic_class", "assignment__faculty")
            .order_by("name")
        )
    else:
        subjects = Subject.objects.none()

    payload = []
    for subject in subjects:
        try:
            assignment = subject.assignment
        except SubjectAssignment.DoesNotExist:
            assignment = None

        faculty = assignment.faculty if assignment else None
        payload.append(
            {
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_code": subject.code,
                "class_id": subject.academic_class_id,
                "class_name": subject.academic_class.class_name if subject.academic_class else "",
                "assignment_id": assignment.id if assignment else None,
                "faculty_id": faculty.id if faculty else None,
                "faculty_name": faculty.name if faculty else "",
                "faculty_email": faculty.email if faculty else "",
                "weekly_timetable": assignment.weekly_timetable if assignment else [],
            }
        )

    return Response(payload)


@api_view(["GET"])
def get_subjects_by_class(request, class_id):
    subjects = Subject.objects.select_related("academic_class").order_by("name")

    if class_id != "all":
        try:
            class_id = int(class_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "Invalid class id."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subjects = subjects.filter(academic_class_id=class_id)

    payload = [
        {
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "academic_class": subject.academic_class_id,
            "academic_class_name": subject.academic_class.class_name if subject.academic_class else "",
        }
        for subject in subjects
    ]

    return Response(payload)


@api_view(["GET"])
def get_student_subjects(request):
    student = get_logged_in_student(request)
    if not student:
        return Response(
            {"detail": "Student session not found or not approved."},
            status=status.HTTP_403_FORBIDDEN,
        )

    subjects = (
        Subject.objects.filter(academic_class=student.academic_class)
        .select_related("academic_class", "assignment__faculty")
        .prefetch_related(
            Prefetch(
                "assignments_list",
                queryset=Assignment.objects.order_by("due_date"),
            )
        )
        .order_by("name")
    )

    payload = [
        {
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "faculty_name": get_assigned_faculty_name(subject),
            "class_name": subject.academic_class.class_name if subject.academic_class else "",
            "assignment_count": len(subject.assignments_list.all()),
        }
        for subject in subjects
    ]

    return Response(
        {
            "student": {
                "id": student.id,
                "name": student.name,
                "roll": student.roll,
                "class_name": student.academic_class.class_name if student.academic_class else "",
            },
            "subjects": payload,
        }
    )


@api_view(["GET"])
def subject_detail(request, subject_id):
    student = get_logged_in_student(request)
    if not student:
        return Response(
            {"detail": "Student session not found or not approved."},
            status=status.HTTP_403_FORBIDDEN,
        )

    subject = (
        Subject.objects.select_related("academic_class", "assignment__faculty")
        .filter(id=subject_id, academic_class=student.academic_class)
        .first()
    )
    if not subject:
        return Response(
            {"detail": "Subject not found for the logged-in student."},
            status=status.HTTP_404_NOT_FOUND,
        )

    attendance_records = list(
        StudentAttendance.objects.filter(student=student, subject=subject)
        .select_related("subject")
        .order_by("-date")
    )
    marks = list(
        Mark.objects.filter(student=student, subject=subject)
        .select_related("subject", "academic_class")
        .order_by("exam_type")
    )
    assignments = list(
        Assignment.objects.filter(subject=subject)
        .prefetch_related(
            Prefetch(
                "submissions",
                queryset=Submission.objects.filter(student=student).select_related("student"),
                to_attr="student_submission_records",
            )
        )
        .order_by("due_date", "title")
    )

    attendance_total = len(attendance_records)
    attendance_present = sum(1 for record in attendance_records if record.status == "Present")
    attendance_percentage = round((attendance_present / attendance_total) * 100, 2) if attendance_total else 0
    marks_total = sum(record.marks for record in marks)
    marks_average = round(marks_total / len(marks), 2) if marks else 0

    assignment_payload = []
    for assignment in assignments:
        submission = assignment.student_submission_records[0] if assignment.student_submission_records else None
        assignment_payload.append(
            {
                "id": assignment.id,
                "title": assignment.title,
                "due_date": assignment.due_date,
                "description": assignment.description,
                "submitted": bool(submission and submission.submitted),
                "status": "Submitted" if submission and submission.submitted else "Pending",
                "marks": submission.marks if submission else None,
            }
        )

    marks_payload = [
        {
            "id": mark.id,
            "exam_type": mark.exam_type,
            "marks": mark.marks,
            "class_name": mark.academic_class.class_name if mark.academic_class else "",
        }
        for mark in marks
    ]

    attendance_payload = [
        {
            "id": record.id,
            "date": record.date,
            "status": record.status,
        }
        for record in attendance_records
    ]

    return Response(
        {
            "student": {
                "id": student.id,
                "name": student.name,
                "roll": student.roll,
                "class_name": student.academic_class.class_name if student.academic_class else "",
            },
            "subject": {
                "id": subject.id,
                "name": subject.name,
                "code": subject.code,
                "faculty_name": get_assigned_faculty_name(subject),
                "class_name": subject.academic_class.class_name if subject.academic_class else "",
            },
            "attendance": {
                "summary": {
                    "total_classes": attendance_total,
                    "present_classes": attendance_present,
                    "percentage": attendance_percentage,
                },
                "records": attendance_payload,
            },
            "assignments": assignment_payload,
            "marks": {
                "records": marks_payload,
                "summary": {
                    "total_marks": marks_total,
                    "average_marks": marks_average,
                    "exam_count": len(marks_payload),
                },
            },
        }
    )


@api_view(["GET"])
def students_by_class(request, class_id):
    academic_class = AcademicClass.objects.filter(id=class_id).first()
    if not academic_class:
        return Response(
            {"detail": "Class not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    students = (
        Student.objects.select_related("academic_class")
        .filter(academic_class_id=class_id, status="Approved")
        .order_by("name")
    )

    payload = [
        {
            "id": student.id,
            "name": student.name,
            "roll_no": student.roll,
            "class_id": student.academic_class_id,
            "class_name": student.academic_class.class_name if student.academic_class else "",
        }
        for student in students
    ]

    return Response(
        {
            "class_id": academic_class.id,
            "class_name": academic_class.class_name,
            "students": payload,
        }
    )


class SearchableModelViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering = ["-id"]
    search_fields = []


class AcademicClassViewSet(SearchableModelViewSet):
    queryset = AcademicClass.objects.all()
    serializer_class = AcademicClassSerializer
    search_fields = ["class_name"]
    ordering = ["class_name"]


class StudentViewSet(SearchableModelViewSet):
    queryset = Student.objects.select_related("academic_class").all()
    serializer_class = StudentSerializer
    search_fields = [
        "name",
        "first_name",
        "middle_name",
        "last_name",
        "email",
        "student_whatsapp_number",
        "parent_whatsapp_number",
        "abc_id",
        "roll",
        "academic_class__class_name",
    ]
    ordering = ["name"]

    def _normalize_form_errors(self, form):
        normalized_errors = {}

        for field_name, field_errors in form.errors.get_json_data().items():
            normalized_errors[field_name] = [entry["message"] for entry in field_errors]

        return normalized_errors

    def _validate_registration_form(self, data, instance=None):
        form_data = data.copy()
        form = StudentRegistrationForm(data=form_data, instance=instance)
        if not form.is_valid():
            raise ValidationError(self._normalize_form_errors(form))

    def create(self, request, *args, **kwargs):
        self._validate_registration_form(request.data)
        response = super().create(request, *args, **kwargs)
        return Response(
            {
                "message": "Student registration submitted successfully.",
                "student": response.data,
            },
            status=status.HTTP_201_CREATED,
            headers=self.get_success_headers(response.data),
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        if not partial:
            self._validate_registration_form(request.data, instance=instance)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response(
            {
                "message": "Student record updated successfully.",
                "student": serializer.data,
            }
        )


class FacultyViewSet(SearchableModelViewSet):
    queryset = Faculty.objects.all()
    serializer_class = FacultySerializer
    search_fields = [
        "name",
        "email",
        "mobile_number",
        "qualification",
        "caste",
        "sub_caste",
        "district",
        "taluka",
    ]
    ordering = ["name"]

    def _normalize_form_errors(self, form):
        normalized_errors = {}

        for field_name, field_errors in form.errors.get_json_data().items():
            normalized_errors[field_name] = [entry["message"] for entry in field_errors]

        return normalized_errors

    def _validate_faculty_form(self, data, instance=None):
        form = FacultyForm(data=data.copy(), instance=instance)
        if not form.is_valid():
            raise ValidationError(self._normalize_form_errors(form))

    def create(self, request, *args, **kwargs):
        self._validate_faculty_form(request.data)
        response = super().create(request, *args, **kwargs)
        return Response(
            {
                "message": "Faculty saved successfully.",
                "faculty": response.data,
            },
            status=status.HTTP_201_CREATED,
            headers=self.get_success_headers(response.data),
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        if not partial:
            self._validate_faculty_form(request.data, instance=instance)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response(
            {
                "message": "Faculty updated successfully.",
                "faculty": serializer.data,
            }
        )


class SubjectViewSet(SearchableModelViewSet):
    queryset = Subject.objects.select_related("academic_class").all()
    serializer_class = SubjectSerializer
    search_fields = ["name", "code", "academic_class__class_name"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        class_id = self.request.query_params.get("academic_class")
        if class_id:
            queryset = queryset.filter(academic_class_id=class_id)
        return queryset


class SubjectAssignmentViewSet(SearchableModelViewSet):
    queryset = SubjectAssignment.objects.select_related("academic_class", "subject", "faculty").all()
    serializer_class = SubjectAssignmentSerializer
    search_fields = ["academic_class__class_name", "subject__name", "faculty__name", "faculty__email"]
    ordering = ["academic_class__class_name"]

    def _validate_subject_assignment_form(self, data, instance=None):
        form_data = data.copy()
        if instance:
            form_data.setdefault("academic_class", instance.academic_class_id)
            form_data.setdefault("subject", instance.subject_id)
            form_data.setdefault("faculty", instance.faculty_id)
            form_data.setdefault("weekly_timetable", instance.weekly_timetable)

        form = SubjectAssignmentForm(data=form_data, instance=instance)
        if not form.is_valid():
            raise ValidationError(form.errors)

    def _validate_subject_is_unassigned(self, subject_id, current_id=None):
        queryset = SubjectAssignment.objects.filter(subject_id=subject_id)
        if current_id:
            queryset = queryset.exclude(pk=current_id)
        if queryset.exists():
            raise ValidationError({"subject": "This subject is already assigned to another faculty."})

    def perform_create(self, serializer):
        self._validate_subject_assignment_form(self.request.data)
        subject_id = serializer.validated_data["subject"].id
        self._validate_subject_is_unassigned(subject_id=subject_id)
        serializer.save()

    def perform_update(self, serializer):
        self._validate_subject_assignment_form(self.request.data, instance=self.get_object())
        subject_id = serializer.validated_data.get("subject", serializer.instance.subject).id
        self._validate_subject_is_unassigned(subject_id=subject_id, current_id=serializer.instance.id)
        serializer.save()


class AssignmentViewSet(SearchableModelViewSet):
    queryset = Assignment.objects.select_related("subject").all()
    serializer_class = AssignmentSerializer
    search_fields = ["subject__name", "title", "description"]
    ordering = ["due_date"]


class SubmissionViewSet(SearchableModelViewSet):
    queryset = Submission.objects.select_related("student", "assignment", "assignment__subject").all()
    serializer_class = SubmissionSerializer
    search_fields = ["student__name", "assignment__title", "assignment__subject__name"]
    ordering = ["assignment__due_date"]


class LeaveApplicationViewSet(SearchableModelViewSet):
    queryset = LeaveApplication.objects.select_related("student", "faculty").all()
    serializer_class = LeaveApplicationSerializer
    search_fields = ["student__name", "faculty__name", "status", "leave_type"]
    ordering = ["-from_date"]


class MarkViewSet(SearchableModelViewSet):
    queryset = Mark.objects.select_related("student", "academic_class", "subject").all()
    serializer_class = MarkSerializer
    search_fields = ["student__name", "subject__name", "academic_class__class_name", "exam_type"]
    ordering = ["student__name"]


class StudentAttendanceViewSet(SearchableModelViewSet):
    queryset = StudentAttendance.objects.select_related("student", "subject").all()
    serializer_class = StudentAttendanceSerializer
    search_fields = ["student__name", "subject__name", "status", "date"]
    ordering = ["-date"]


class StaffAttendanceViewSet(SearchableModelViewSet):
    queryset = StaffAttendance.objects.select_related("faculty").all()
    serializer_class = StaffAttendanceSerializer
    search_fields = ["faculty__name", "faculty__email", "status", "date"]
    ordering = ["-date"]


def home(request):
    return render(request, 'index.html')
