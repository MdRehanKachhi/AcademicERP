from django import forms

from .models import Faculty, Student, SubjectAssignment


class StudentRegistrationForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = [
            "first_name",
            "middle_name",
            "last_name",
            "email",
            "date_of_birth",
            "gender",
            "student_whatsapp_number",
            "parent_whatsapp_number",
            "caste",
            "sub_caste",
            "address",
            "district",
            "taluka",
            "pincode",
            "abc_id",
            "academic_class",
        ]

    def clean(self):
        cleaned_data = super().clean()

        if cleaned_data.get("parent_whatsapp_number"):
            cleaned_data["parent_mobile"] = cleaned_data["parent_whatsapp_number"]

        return cleaned_data


class FacultyForm(forms.ModelForm):
    class Meta:
        model = Faculty
        fields = [
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


class SubjectAssignmentForm(forms.ModelForm):
    class Meta:
        model = SubjectAssignment
        fields = ["academic_class", "subject", "faculty", "weekly_timetable"]

    def clean(self):
        cleaned_data = super().clean()
        subject = cleaned_data.get("subject")
        academic_class = cleaned_data.get("academic_class")

        if subject and academic_class and subject.academic_class_id != academic_class.id:
            self.add_error("subject", "Selected subject does not belong to the selected class.")

        if subject:
            queryset = SubjectAssignment.objects.filter(subject=subject)
            if self.instance and self.instance.pk:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                self.add_error("subject", "This subject is already assigned to another faculty.")

        return cleaned_data
