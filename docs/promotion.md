# Year Promotion Feature — Documentation

## Overview

This feature allows an admin to evaluate all students at end of year, determine each student's promotion state, preview the results without touching the database, and then commit the changes in a single operation.

The flow is always: **Preview → Review → Commit**.

---

## Files

### `types/promotion.ts`
Shared TypeScript types used across the service and controller.

**`PromotionState`**
The four possible outcomes for a student:

| State | Meaning |
|---|---|
| `FULLY_PASSED` | Passed all courses (naturally or via aided marks). Moves to next year, all courses detached. |
| `GRADUATED` | Same as FULLY_PASSED but the student is in the last year. No year change. |
| `MOVED` | Failed ≤ `aided_pass_courses_number` courses (after aid attempt). Moves to next year, failed courses kept. |
| `FAILED` | Failed too many courses, aid couldn't rescue. No changes made. |

**`CourseResult`**
Per-course breakdown for a student:
- `total_grade` — sum of `practical_grade + theoretical_grade` from the `Mark` model
- `deficit` — how many marks below the passing threshold (0 if passed)
- `aided` — `true` if this course was rescued by the aided marks pool

**`StudentPromotionResult`**
Full per-student output including state, course breakdown, `courses_to_keep`, `courses_to_detach`, and `aided_marks_used`.

**`PromotionPreviewResult`**
The top-level shape written to the JSON file. Contains `settings` snapshot, `summary` counts, and the full `students` array.

---

### `services/promotion.service.ts`
Pure calculation logic. **Makes no DB writes.** Called by the preview endpoint.

**`generatePromotionPreview()`**

Steps:
1. Loads `SystemSettings` (passing_grade, aided_marks_number, aided_pass_courses_number).
2. Loads all `Year` records ordered by `order` and builds a next-year lookup map.
3. Loads all students with their enrolled courses and marks in a single query.
4. Calls `evaluateStudent()` for each student.
5. Returns the full `PromotionPreviewResult` with a summary.

**`evaluateStudent()` — the core decision logic**

```
1. Build marks lookup: marks_course_id → (practical + theoretical)
2. For each enrolled course, calculate deficit = max(0, passingGrade - totalGrade)
3. Sum totalDeficit across ALL failed courses

4. Aided marks rule:
   if totalDeficit <= aided_marks_number
     → ALL failed courses rescued, aided = true, effectivelyFailed = 0
   else
     → no aid applied at all

5. State decision:
   effectivelyFailed = 0                        → FULLY_PASSED (or GRADUATED)
   effectivelyFailed <= aidedPassCoursesNumber  → MOVED
   otherwise                                    → FAILED

6. Course attachment plan:
   FULLY_PASSED / GRADUATED → detach all courses
   MOVED                    → keep failed courses, detach passed ones
   FAILED                   → no changes
```

> **Important:** Aid is all-or-nothing. If a student failed 2 courses by 1 and 5 marks, and the pool is 2, no aid is applied because 1 + 5 = 6 > 2.

---

### `controllers/promotion.controller.ts`
Three endpoints. The preview file lives at `/data/promotion-preview.json` relative to `process.cwd()`.

---

#### `GET /promotion/preview`
Runs `generatePromotionPreview()`, saves the result to the JSON file (overwrites on re-run), and returns the full preview in the response. **No DB changes.**

Use this whenever the admin wants to see the current state. Safe to call multiple times.

**Response:**
```json
{
  "success": true,
  "message": "Promotion preview generated. Review the results before committing.",
  "data": {
    "generated_at": "2025-06-01T10:00:00.000Z",
    "settings": { "passing_grade": 60, "aided_marks_number": 2, "aided_pass_courses_number": 1 },
    "summary": { "total_students": 120, "fully_passed": 80, "graduated": 5, "moved": 25, "failed": 10 },
    "students": [ ... ]
  }
}
```

---

#### `GET /promotion/preview/file`
Returns the last saved preview JSON without recalculating. Useful for the admin to re-read results after navigating away.

Returns `404` if no preview file exists yet.

---

#### `POST /promotion/commit`
Reads the last saved preview file and applies all DB mutations inside a single Prisma transaction. After success, **the preview file is deleted** to prevent double-commits.

**Per student, the transaction does:**

| State | DB actions |
|---|---|
| `FULLY_PASSED` | Delete all `StudentCourse` rows → Update `student.year_id` to next year → Clear `section_id` and `major_id` |
| `GRADUATED` | Delete all `StudentCourse` rows → No year change |
| `MOVED` | Delete passed `StudentCourse` rows → Set failed `StudentCourse.status = FAILED` → Update `student.year_id` → Clear `section_id` and `major_id` |
| `FAILED` | Nothing |

> After commit, section/major/group must be **reassigned manually by the admin** since these differ per year.

Returns `400` if no preview file is found (i.e. preview was never run or already committed).

**Response:**
```json
{
  "success": true,
  "message": "Promotion committed successfully.",
  "summary": { "total_students": 120, "fully_passed": 80, "graduated": 5, "moved": 25, "failed": 10 }
}
```

---

## Required `system_settings` fields

Make sure these fields exist in your `SystemSettings` Prisma model:

```prisma
passing_grade             Int?   // e.g. 60
aided_marks_number        Int?   // max total marks pool for aid
aided_pass_courses_number Int?   // max failed courses to still be MOVED
```
