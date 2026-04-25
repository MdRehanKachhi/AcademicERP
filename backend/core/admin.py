from django.contrib import admin

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


admin.site.register(AcademicClass)
admin.site.register(Student)
admin.site.register(Faculty)
admin.site.register(Subject)
admin.site.register(SubjectAssignment)
admin.site.register(Assignment)
admin.site.register(Submission)
admin.site.register(LeaveApplication)
admin.site.register(Mark)
admin.site.register(StudentAttendance)
admin.site.register(StaffAttendance)
