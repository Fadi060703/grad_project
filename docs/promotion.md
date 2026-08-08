# End Year Action — Documentation

## Overview

The end year action evaluates every student at the end of the academic year and immediately applies the required database changes in one API call.

There is no preview file and no separate commit step.

```http
POST /actions/end-year-action
```

Access is protected by:

- `authMiddleware`
- `check("actions:end-year-action")`

Only the `ADMIN` role currently has this permission.

---

## Academic key rule

Marks are checked only for the current academic key from `SystemSettings.current_academic_key`.

If `current_academic_key` is `null`, the action treats it as an empty string:

```ts
const academicKey = settings.current_academic_key ?? "";
```

Only `Mark` rows matching this key are used:

```ts
where: {
  academic_key: academicKey
}
```

A missing mark for a student's enrolled course is treated as grade `0`.

---

## Mark/course relation

The old `MarksCourse` model is no longer used.

Marks are matched directly by `Mark.course_id`:

```prisma
model Mark {
  course_id         Int
  student_id        Int
  academic_key      String
  practical_grade   Int
  theoretical_grade Int

  @@unique([course_id, student_id, academic_key])
}
```

For each enrolled `StudentCourse.course_id`, the service looks for the matching `Mark.course_id` in the current academic key.

---

## Promotion states

| State | Meaning |
|---|---|
| `FULLY_PASSED` | Student passed all enrolled courses naturally or via aided marks. Student moves to the next year. All current courses are detached. |
| `MOVED` | Student still failed some courses, but the count is less than or equal to `aided_pass_courses_number`. Student moves to the next year. Passed courses are detached; failed courses stay attached. |
| `FAILED` | Student failed too many courses. Student stays in the same year. Passed courses are detached; failed courses stay attached. |
| `GRADUATED` | Student passed all enrolled courses while already in the last year. The student's marks, student profile, and user account are deleted. |

---

## Aided marks rule

Aided marks are all-or-nothing.

For each student:

1. Calculate each course total:

```ts
practical_grade + theoretical_grade
```

2. Calculate each failed course deficit:

```ts
max(0, passing_grade - total_grade)
```

3. Sum the deficits for all failed courses.

4. If the total deficit is less than or equal to `aided_marks_number`, all failed courses are rescued and become effectively passed.

5. If the total deficit is greater than `aided_marks_number`, no aid is applied at all.

Example:

- Course A deficit: `1`
- Course B deficit: `5`
- `aided_marks_number`: `2`

Total deficit is `6`, so no aid is applied.

---

## Database actions

All changes run inside a single Prisma transaction.

| State | DB actions |
|---|---|
| `FULLY_PASSED` | Delete all current `StudentCourse` rows for the student → update `student.year_id` to next year → clear `section_id` and `major_id` → keep `group_id` unchanged |
| `MOVED` | Delete passed `StudentCourse` rows → keep failed course rows attached → update `student.year_id` to next year → clear `section_id` and `major_id` → keep `group_id` unchanged |
| `FAILED` | Delete passed `StudentCourse` rows → keep failed course rows attached → keep the same `year_id`, `section_id`, `major_id`, and `group_id` |
| `GRADUATED` | Delete all `Mark` rows for the student → delete all `StudentCourse` rows for the student → delete the `Student` row → delete the related `User` row |

`StudentCourse.status` and `StudentCourse.enrollment_date` are not used by this action.

The action does not attach next-year courses. Course attachment is handled later by the start year action.

---

## Response

The API returns a summary and a full per-student report.

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

Each student result includes:

- student identity
- current year
- next year, when applicable
- final state
- total/passed/failed course counts
- aided marks used
- course-level grade breakdown
- `courses_to_keep`
- `courses_to_detach`

---

## Required system settings

```prisma
passing_grade             Int
current_academic_key      String?
aided_marks_number        Int?
aided_pass_courses_number Int?
```
