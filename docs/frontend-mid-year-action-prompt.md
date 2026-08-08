# Frontend AI Agent Prompt — Mid Year Action Page

Implement the frontend UI for the backend **Mid Year Action**.

## Route and permission

Add this page under the sidebar group:

```text
Actions
```

Sidebar item:

```text
Mid Year Action
```

Only users with this permission can access it:

```text
actions:mid-year-action
```

If the frontend also checks role, require `ADMIN` too.

API endpoint:

```http
POST /actions/mid-year-action
```

Request body:

```json
{
  "confirm": true
}
```

---

## Page notes for the admin

Show a clear warning/notes card above the button.

Suggested text:

```text
This action starts the second semester.

Before running it, make sure all first-semester marks for the current academic key are complete and correct.

What this action will do:

- It will update the academic key from FIRST_YYYY to SECOND_YYYY.
- If the current key is empty or already SECOND, it will set SECOND_{current calendar year}.
- It will check every currently attached course for every student.
- Courses the student passed will be detached.
- Courses the student did not pass will remain attached.
- Aided marks are not used in this action.
- It will attach second-semester courses for each student's section, major, or direct year courses.
- Students marked as failed from the previous year may receive fewer second-semester courses depending on how many failed courses remain.
- It will delete all weekly lectures and their attendance records.

This action changes course attachments and should only be run at mid year.
```

Use the project's existing alert/card components and destructive-action styling.

---

## Confirmation dialog

Do not call the API immediately.

Open a confirmation dialog first.

Suggested dialog text:

```text
Are you sure you want to run the Mid Year Action?

This will update the academic key, detach passed courses, keep failed courses, attach second-semester courses, and delete all weekly lectures.

Make sure marks are complete before continuing.
```

The confirm action must send `confirm: true`.

Disable the confirm button while loading.

---

## Success handling

Expected response:

```json
{
  "success": true,
  "message": "تم تنفيذ إجراء منتصف السنة بنجاح."
}
```

After success:

- Show a success toast using the backend `message`.
- No Excel download is needed.
- No table is needed.

---

## Error handling

Backend validation errors are in Arabic.

On error:

- Show the backend error message if available.
- Keep the page usable so the admin can retry.
