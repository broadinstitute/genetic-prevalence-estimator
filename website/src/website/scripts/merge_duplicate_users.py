# from django.contrib.auth import get_user_model
# from django.db.models import Q
# from django.utils import timezone
# from datetime import datetime
# from calculator.models import VariantListAccessPermission # Adjust your import

from django.contrib.auth import get_user_model
from django.db.models import Q, Count
from django.db.models.functions import Lower
from django.utils import timezone
from datetime import datetime

# Adjust these imports to perfectly match your app names!
from calculator.models import VariantList, VariantListAccessPermission

# def merge_duplicate_users(target_email):
#     User = get_user_model()

#     # 1. Find the duplicates
#     # users = list(User.objects.filter(username__iexact=target_email))
#     users = list(
#     User.objects.filter(
#         Q(username__iexact=target_email) | Q(email__iexact=target_email)
#     ).distinct()
# )

#     if len(users) != 2:
#         print(f"Skipping {target_email}: Found {len(users)} users, expected exactly 2.")
#         return False

#     user_a, user_b = users[0], users[1]

#     min_time = datetime.min.replace(tzinfo=timezone.utc)
#     time_a = user_a.last_login or min_time
#     time_b = user_b.last_login or min_time

#     if time_a > time_b:
#         google_user, stub_user = user_a, user_b
#     elif time_b > time_a:
#         google_user, stub_user = user_b, user_a
#     else:
#         print(f"Skipping {target_email}: Cannot safely determine the real user. Both last_login times are equal or None.")
#         return False

#     # 3. Move the permissions to the Google user
#     perms_moved = VariantListAccessPermission.objects.filter(user=stub_user).update(user=google_user)

#     # Optional: Re-assign anything else the stub might own in your app
#     # VariantList.objects.filter(created_by=stub_user).update(created_by=google_user)

#     # 4. Delete the stub user
#     stub_id = stub_user.id
#     stub_user.delete()

#     # 5. Normalize the remaining user to strictly lowercase
#     google_user.username = google_user.username.lower()
#     google_user.email = google_user.email.lower()
#     google_user.save()

#     print(f"Success! Moved {perms_moved} permissions to User {google_user.id}. Deleted Stub User {stub_id}.")
#     print(f"Normalized remaining user to: {google_user.username}")

#     return Tru


def process_duplicate_users(target_email, dry_run=True):
    User = get_user_model()

    # Find ALL duplicates (case-insensitive) across both fields
    users = list(
        User.objects.filter(
            Q(username__iexact=target_email) | Q(email__iexact=target_email)
        ).distinct()
    )

    if len(users) <= 1:
        return False

    # Sort users by last_login descending (most recent first)
    min_time = datetime.min.replace(tzinfo=timezone.utc)
    users.sort(key=lambda u: u.last_login or min_time, reverse=True)

    primary_user = users[0]
    stubs = users[1:]

    print(f"\n{'='*60}")
    print(f"REPORT FOR: {target_email} (Found {len(users)} accounts)")
    print(f"{'='*60}")

    for i, u in enumerate(users):
        role = "PRIMARY (Will Keep)" if i == 0 else f"STUB {i} (Will Merge/Delete)"

        perms_count = VariantListAccessPermission.objects.filter(user=u).count()
        lists_created_count = VariantList.objects.filter(created_by=u).count()

        login_str = (
            u.last_login.strftime("%Y-%m-%d %H:%M:%S") if u.last_login else "Never"
        )
        created_str = u.date_joined.strftime("%Y-%m-%d %H:%M:%S")

        print(f"[{role}] ID: {u.id} | username: '{u.username}' | email: '{u.email}'")
        print(f"    Time Created : {created_str}")
        print(f"    Last Login   : {login_str}")
        print(f"    Permissions  : {perms_count}")
        print(f"    Lists Created: {lists_created_count}")
        print("-" * 60)

    if dry_run:
        print(">>> DRY RUN MODE: No changes made.\n")
        return True

    # --- EXECUTE THE MERGE ---
    print(">>> EXECUTING MERGE...")
    total_perms_moved = 0
    total_lists_moved = 0

    for stub in stubs:
        stub_id = stub.id

        # Move permissions & lists
        perms_moved = VariantListAccessPermission.objects.filter(user=stub).update(
            user=primary_user
        )
        lists_moved = VariantList.objects.filter(created_by=stub).update(
            created_by=primary_user
        )

        total_perms_moved += perms_moved
        total_lists_moved += lists_moved

        # Delete the stub
        stub.delete()
        print(
            f"    -> Deleted Stub {stub_id}. Moved {perms_moved} perms, {lists_moved} lists."
        )

    # Normalize the primary user
    primary_user.username = primary_user.username.lower()
    primary_user.email = primary_user.email.lower()
    primary_user.save()

    print(f">>> MERGE COMPLETE. Kept User {primary_user.id} ({primary_user.username}).")
    print(
        f">>> Grand Total Moved: {total_perms_moved} perms, {total_lists_moved} lists.\n"
    )
    return True


def find_and_process_all_duplicates(dry_run=True):
    """
    Wrapper script to find all duplicate accounts and process them.
    Defaults to dry_run=True so it only prints reports.
    """
    User = get_user_model()

    print("Scanning database for duplicate users by username...\n")

    # Group by lowercase username and count
    duplicate_groups = (
        User.objects.annotate(lower_name=Lower("username"))
        .values("lower_name")
        .annotate(user_count=Count("id"))
        .filter(user_count__gt=1)
    )

    duplicate_emails = [
        group["lower_name"] for group in duplicate_groups if group["lower_name"]
    ]

    if not duplicate_emails:
        print("Great news! No duplicate users found in the database.")
        return

    print(
        f"Found {len(duplicate_emails)} unique email(s) with multiple accounts attached."
    )

    # Process each duplicate group
    for email in duplicate_emails:
        process_duplicate_users(email, dry_run=dry_run)

    if dry_run:
        print("\n" + "*" * 60)
        print("DRY RUN COMPLETE. Review the logs above.")
        print("If everything looks perfectly correct, execute the merge by running:")
        print("find_and_process_all_duplicates(dry_run=False)")
        print("*" * 60 + "\n")
    else:
        print("\n*** BULK MERGE COMPLETELY FINISHED! ***\n")


# --- Run the dry run immediately when pasted into the shell ---
# find_and_process_all_duplicates(dry_run=True)
