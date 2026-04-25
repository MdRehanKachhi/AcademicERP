from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AcademicClassViewSet,
    AssignmentViewSet,
    class_subject_assignments,
    FacultyViewSet,
    LeaveApplicationViewSet,
    MarkViewSet,
    StaffAttendanceViewSet,
    StudentAttendanceViewSet,
    StudentViewSet,
    SubmissionViewSet,
    SubjectAssignmentViewSet,
    SubjectViewSet,
    get_subjects_by_class,
    get_student_subjects,
    health_check,
    students_by_class,
    subject_detail,
)


router = DefaultRouter()
router.register("classes", AcademicClassViewSet, basename="class")
router.register("students", StudentViewSet, basename="student")
router.register("faculty", FacultyViewSet, basename="faculty")
router.register("subjects", SubjectViewSet, basename="subject")
router.register("assignments", SubjectAssignmentViewSet, basename="assignment")
router.register("assignment-items", AssignmentViewSet, basename="assignment-item")
router.register("submissions", SubmissionViewSet, basename="submission")
router.register("leaves", LeaveApplicationViewSet, basename="leave")
router.register("marks", MarkViewSet, basename="mark")
router.register("student-attendance", StudentAttendanceViewSet, basename="student-attendance")
router.register("staff-attendance", StaffAttendanceViewSet, basename="staff-attendance")

urlpatterns = [
    path("health/", health_check, name="health"),
    path("class-subject-assignments/", class_subject_assignments, name="class-subject-assignments"),
    path("get-subjects-by-class/<str:class_id>/", get_subjects_by_class, name="get-subjects-by-class"),
    path("students/by-class/<int:class_id>/", students_by_class, name="students-by-class"),
    path("students/semester-subjects/", get_student_subjects, name="student-subjects"),
    path("students/subjects/<int:subject_id>/", subject_detail, name="subject-detail"),
    path("", include(router.urls)),
]
