# Frontend AI Agent Prompt — Start Year Action Page

Implement the frontend UI for the backend **Start Year Action**.

## Route and permission

Add a page under the existing/new sidebar group:

```text
Actions
```

Sidebar item:

```text
Start Year Action
```

Only users with this permission can access it:

```text
actions:start-year-action
```

If the frontend also checks role, require `ADMIN` too.

API endpoint:

```http
POST /actions/start-year-action
```

---

## Backend request shape

Send:

```json
{
  "confirm": true,
  "first_year_students": [
    {
      "student_id": 1001,
      "username": "student1001",
      "full_name": "Student Name",
      "mother_name": "Mother Name"
    }
  ],
  "major_assignments": [
    {
      "student_id": 2001,
      "major_id": 3
    }
  ]
}
```

Notes:

- `confirm` must be `true`.
- Use the existing frontend Excel upload tool for `first_year_students`.
- Use the existing frontend Excel upload tool for `major_assignments`.
- Do not generate passwords in the frontend. The backend generates passwords.
- No need to add frontend validation that every major-year student is included. The page should show a clear note, and the backend will validate.

---

## Page notes for the admin

Place clear human-readable notes above the action button.

Suggested text:

```text
This action starts the new academic year.

Before running it, make sure the End Year Action has already been completed.

What this action will do:

- It will automatically update the academic key from SECOND_YYYY to FIRST_{next year}.
- If the current academic key is empty, it will create FIRST_{next calendar year}.
- It will create the uploaded first-year students and generate passwords for them.
- It will reshuffle all students across their sections or majors.
- For years without majors, students are distributed equally across sections.
- For years with majors, you must upload each student's intended major.
- It will then distribute students equally across the groups inside their section or major.
- It will attach first-semester courses while keeping any previously failed course attachments.
- Students marked as failed from the end-year action will not receive new first-semester courses.
- It will generate new unique 4-digit exam seat numbers for all students.

This action changes academic placement and should only be run once at the start of the year.
```

Use the project's existing alert/card components and destructive-action styling.

No need to add a separate academic key preview section.

---

## Upload inputs

The page should provide two upload areas using the existing Excel upload tool.

### First-year students Excel

Required columns:

```text
student_id
username
full_name
mother_name
```

This can be empty if there are no first-year students to add.

### Major assignments Excel

Required columns:

```text
student_id
major_id
```

Use this for students in years that have majors.

Do not require frontend validation that all major-year students exist in the upload. The backend will return Arabic validation errors if anything is missing or wrong.

---

## Confirmation dialog

Do not call the API immediately when the admin clicks the button.

Open a confirmation dialog first.

Suggested dialog text:

```text
Are you sure you want to run the Start Year Action?

This will update the academic key, create first-year students, reshuffle all students into sections/majors/groups, attach first-semester courses, and regenerate exam seat numbers.

Make sure your Excel files are correct before continuing.
```

The confirm action must send `confirm: true` in the request body.

Disable the confirm button while loading.

---

## Success handling

Expected response:

```json
{
  "success": true,
  "message": "تم تنفيذ إجراء بداية السنة بنجاح.",
  "data": {
    "created_students": [
      {
        "student_id": 1001,
        "username": "student1001",
        "full_name": "Student Name",
        "password": "Generated123"
      }
    ]
  }
}
```

After a successful response:

1. Show a success toast using the backend `message`.
2. Immediately download an Excel file containing `data.created_students`.
3. Do not show a separate created-students table.
4. The Excel columns should be:
   - `student_id`
   - `username`
   - `full_name`
   - `password`

Important: passwords are only available in this API response, so the Excel should download immediately.

---

## Error handling

Backend validation errors are in Arabic.

On error:

- Show the backend error message if available.
- Keep the uploaded data in the page so the admin can fix and retry.
- Do not download an Excel file on failure.
