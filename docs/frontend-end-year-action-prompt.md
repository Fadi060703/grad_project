# Frontend AI Agent Prompt — End Year Action Page

You are implementing the frontend for a backend feature called **End Year Action**.

## Goal

Create a new admin page named **End Year Action**.

The page allows an authorized admin to trigger the backend end-year action API:

```http
POST /actions/end-year-action
```

This is a destructive operation. The UI must explain clearly what will happen and must ask for confirmation before calling the API.

---

## Access and navigation

Add a new sidebar group named:

```text
Actions
```

Under it, add sidebar items/pages for actions, including:

```text
End Year Action
Start Year Action
```

Only users who are admins and have the permission below should be able to access or see this page:

```text
actions:end-year-action
```

Follow the existing frontend permission/sidebar patterns in the project.

If the app already uses only permissions for access control, use the permission. If it checks role too, require `ADMIN` as well.

---

## Page content

The page should be simple and focused.

Add a clear title:

```text
End Year Action
```

Above the action button, show human-readable notes explaining what the action does.

Use plain language. Example content:

```text
This action will process all students for the current academic year.

Before running it, make sure all marks for the current academic key are entered correctly.

What this action will do:

- Students who passed all courses will move to the next year.
- Students who passed all courses in the last year will be graduated and deleted from the system, including their student profile, user account, and marks.
- Students who failed only an allowed number of courses will move to the next year, but their failed courses will stay attached.
- Students who failed too many courses will stay in the same year, but their passed courses will be detached.
- Passed courses will be detached from students.
- The action does not attach next-year courses. That will happen later in the Start Year Action.
- Student groups are kept as they are for now and will be reassigned later in the Start Year Action.
- All stored weekly lectures and their attendance records will be deleted.

This action cannot be safely undone from the UI.
```

Then add a primary/destructive button:

```text
Run End Year Action
```

Use the project's existing button, card, alert, loading, toast, and dialog components/styles.

---

## Confirmation dialog

When the admin clicks the button, do not call the API immediately.

Open a confirmation dialog first.

The dialog should clearly say that this operation is destructive.

Suggested dialog text:

```text
Are you sure you want to run the End Year Action?

This will update student years, detach courses, and delete graduated students with their users and marks.

Make sure all marks for the current academic key are complete and correct before continuing.
```

Dialog actions:

- Cancel: closes the dialog and does nothing.
- Confirm / Run Action: calls `POST /actions/end-year-action`.

Disable the confirm button while the request is loading.

---

## API behavior

Call:

```http
POST /actions/end-year-action
```

Expected success response:

```json
{
  "success": true,
  "message": "End year action executed successfully.",
  "data": {
    "executed_at": "2026-08-08T10:00:00.000Z",
    "academic_key": "2025-2026",
    "settings": {
      "passing_grade": 60,
      "aided_marks_number": 2,
      "aided_pass_courses_number": 1
    },
    "summary": {
      "total_students": 120,
      "fully_passed": 80,
      "graduated": 5,
      "moved": 25,
      "failed": 10
    },
    "students": []
  }
}
```

After success:

- Show a success toast using `message` from the response.
- Display the summary counts on the page:
  - Total students
  - Fully passed
  - Moved
  - Failed
  - Graduated
- Optionally show the `academic_key` and `executed_at`.

On error:

- Show an error toast/message using the backend error message if available.
- Keep the page usable so the admin can retry.

---

## Important UX requirements

- Make the destructive nature visually clear.
- Do not auto-run the API on page load.
- Do not call the API without confirmation.
- Do not expose the page to users without `actions:end-year-action` permission.

