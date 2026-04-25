from django.core.management.base import BaseCommand

from core.models import SubjectAssignment


class Command(BaseCommand):
    help = "Detect duplicate subject assignments and keep only the first assignment per subject."

    def handle(self, *args, **options):
        assignments = SubjectAssignment.objects.select_related("subject").order_by("subject_id", "id")
        seen_subject_ids = set()
        duplicate_ids = []

        for assignment in assignments:
            if assignment.subject_id in seen_subject_ids:
                duplicate_ids.append(assignment.id)
            else:
                seen_subject_ids.add(assignment.subject_id)

        if not duplicate_ids:
            self.stdout.write(self.style.SUCCESS("No duplicate subject assignments found."))
            return

        deleted_count, _ = SubjectAssignment.objects.filter(id__in=duplicate_ids).delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Removed {deleted_count} duplicate assignment(s). Kept the first assignment for each subject."
            )
        )
