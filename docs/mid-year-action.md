# Mid Year Action

## Endpoint

```http
POST /actions/mid-year-action
```

Permission:

```text
actions:mid-year-action
```

Only `ADMIN` has this permission.

---

## Request body

```json
{
  "confirm": true
}
```

`confirm` must be `true`.

---

## What the action does

The action runs inside one Prisma transaction.

1. Calculates the next academic key.
   - `FIRST_2027` becomes `SECOND_2027`.
   - If the previous key is empty/null or starts with `SECOND`, the new key becomes `SECOND_{current calendar year}`.
2. Evaluates every currently attached student course using marks for the current academic key before the update.
   - Missing marks count as `0`.
   - No aided marks are used.
   - If `practical_grade + theoretical_grade >= passing_grade`, the course is detached.
   - Otherwise, the course remains attached.
3. Attaches second-semester courses.
   - Section students get `semester = SECOND` courses linked through `SectionCourse`.
   - Major students get `semester = SECOND` courses linked through `MajorCourse`.
   - Every student also gets direct year courses where the course has no section or major links and `semester = SECOND`.
   - Duplicate `StudentCourse` rows are skipped.
4. Handles students marked `is_failed = true` from the end-year action specially.
   - Their `is_failed` flag is not changed by the mid-year action.
   - If they still have 4 failed courses and `aided_pass_courses_number = 4`, they get 0 new second-semester courses.
   - If they still have 3 failed courses, they get 1 new second-semester course.
   - If they still have 2, 1, or 0 failed courses, they get at most 2 new second-semester courses.
   - In general: `min(2, max(0, aided_pass_courses_number - remaining_failed_courses))`.
   - When limited, courses are chosen by lowest `Course.id` first.
5. Deletes all stored `WeeklyLecture` rows. Related attendance rows are deleted by cascade.
6. Updates `system_settings.current_academic_key`.

---

## Response

```json
{
  "success": true,
  "message": "تم تنفيذ إجراء منتصف السنة بنجاح."
}
```
