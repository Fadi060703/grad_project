# Handoff: Pending Backend Tasks

This handoff covers the 5 agreed tasks that are **not implemented yet**. Keep changes focused and follow existing controller/validator/router patterns.

## Useful context files

- Locations:
  - `src/controllers/locationsController.ts`
  - `src/validators/locations.ts`
  - Prisma model: `src/prisma/schema.prisma` → `UniversityLocation.photo_array String[] @default([])`
- Password change:
  - Student route: `src/router/student.routes.ts`
  - Student password logic: `src/controllers/studentProfileController.ts`
  - Student validator: `src/validators/student-profile.ts`
  - Auth/router area: search existing auth routes/controllers before adding `/auth/change-password`
- Student/group data:
  - Prisma models: `Student`, `Group`, `Section`, `Major` in `src/prisma/schema.prisma`
  - Existing student/user logic in `src/controllers/userController.ts`
- Announcements:
  - `src/controllers/announcementController.ts`
  - `src/validators/announcements.ts`
  - Prisma model `Announcement.attachments String[] @default([])`
- Marks:
  - `src/controllers/marksController.ts`
  - `src/validators/marks.ts`
  - `src/router/exam.routes.ts` currently hosts marks routes
  - Prisma models: `Mark`, `Course`, `SystemSettings`

---

## 0. Add `photo_array` to location CRUD

`photo_array` already exists in Prisma on `UniversityLocation`.

Requirements:
- Treat it as `string[]` of image URLs/paths.
- Create: accept optional `photo_array`; default to `[]` if omitted.
- Update: if provided, replace the whole array.
- Get/list responses must include `photo_array`.
- Update location validators and controller selects/create/update data.

---

## 1. Dashboard user change-password API

Add a separate API for dashboard users, not students.

Requirements:
- Route: `PUT /auth/change-password`
- No `check(...)` permission middleware.
- Must require `authMiddleware`.
- Allowed roles: all non-students:
  - `ADMIN`
  - `DOCTOR`
  - `TEACHER`
  - `CONTENT_DE`
  - `EXAMS_DE`
  - `LECTURES_SCHEDULE_DE`
  - `MARKS_DE`
- Reject `STUDENT` with forbidden error.
- Body identical to student password change:
  ```json
  {
    "current_password": "...",
    "new_password": "...",
    "confirm_password": "..."
  }
  ```
- Same password rules as `changeStudentPasswordSchema`.
- Logic:
  - Load current authenticated `User` by `req.user.id`.
  - Compare `current_password` with bcrypt.
  - Hash and update to `new_password`.
  - Return success message.
- Use separate controller and validator from student profile files.

---

## 2. Student group swap API

Add an admin-only API to swap groups between two students.

Suggested route:

```http
POST /students/swap-groups
```

Suggested body:

```json
{
  "student_a_id": 1,
  "student_b_id": 2
}
```

Requirements:
- IDs are `Student.student_id`, not `User.id`.
- Admin only.
- Validate both students exist.
- Reject if same student.
- Reject if both already have same `group_id`.
- Validate both students are in the same academic scope:
  - same `year_id`
  - same `section_id` if section-based
  - same `major_id` if major-based
- Validate both groups belong to the same section/major scope as the students.
- Transactionally swap only `student.group_id`:
  - A gets B’s old group
  - B gets A’s old group
- Do **not** modify existing attendance rows or historical data.

---

## 3. Announcement attachments check

Findings from current code:
- Prisma model already has `attachments String[] @default([])`.
- Create validator accepts `attachments: z.array(z.string()).default([])`.
- Update validator accepts `attachments: z.array(z.string()).optional()`.
- Create controller writes `attachments`.
- Update controller updates `attachments`.
- Get/list return Prisma announcement records with attachments.

So string-array attachment URLs are already handled for create/update/get.

Only implement more if the user later requests actual file upload support. For this handoff, just inform/confirm this state; no code appears necessary.

---

## 4. Course marks publishing flow

### Agreed intent

- Students should see only published marks.
- `/my-student-marks` should return **one latest published mark per course**, not duplicate course rows.
- Admin/DE marks table should default to the current academic key so old semester marks do not appear unless explicitly queried.
- Practical marks can be published first; full marks later.
- If only practical marks are published, students see `theoretical_grade: 0` and `total_grade = practical_grade`.
- If full marks are published, students see practical + theoretical + total.

### Prisma changes

Add to `SystemSettings`:

```prisma
current_academic_key String?
```

Update system settings validators/controllers to support it.

Add to `Course`:

```prisma
is_practical_marks_published Boolean @default(false)
is_marks_published           Boolean @default(false)
```

Add to `Mark`:

```prisma
academic_key String
```

Update uniqueness from current `(course_id, student_id)` to:

```prisma
@@unique([course_id, student_id, academic_key])
```

No publish flags on `Mark`.

Optional but useful for audit/history: add `CourseMarksPublication` model. If added, it should record:

```prisma
course_id
academic_key
publish_type // PRACTICAL or FULL
published_by
published_at
```

Use it for history/audit, not as the only frontend status source. Frontend status comes from course booleans.

### Bulk create marks behavior

`bulkCreateMarks` should use `systemSettings.current_academic_key` automatically.

For each submitted mark:
- upsert by `(course_id, student_id, academic_key)`.
- If existing, update grades.
- If missing, create it.

This lets the admin/DE:
1. Add practical marks.
2. Publish practical.
3. Later bulk upload full marks and update existing records.
4. Publish full.

### Admin/DE `getAllMarks`

- Default filter: `academic_key = systemSettings.current_academic_key`.
- Optional query override: `GET /marks?academic_key=2025-SECOND`.
- If no marks exist for the current academic key, return empty table.
- Dashboard users can still see draft marks for the current key even before publishing.

### Publish APIs

Add two APIs:

```http
POST /marks/courses/:courseId/publish-practical
POST /marks/courses/:courseId/publish-full
```

Allowed roles:
- `ADMIN`
- `MARKS_DE`
- `EXAMS_DE`

Use existing marks permissions style if needed, but role check is required.

Publish practical:
- Use `systemSettings.current_academic_key`.
- Validate course exists.
- Validate every currently enrolled student in that course has a `Mark` record for `(course_id, student_id, current_academic_key)`.
- If complete, set:
  ```ts
  course.is_practical_marks_published = true
  ```
- Optionally create audit row with `publish_type = "PRACTICAL"`.

Publish full:
- Use `systemSettings.current_academic_key`.
- Same completeness rule: every enrolled student has a mark record for current key. Grades may be `0`; record existence is what matters.
- If complete, set:
  ```ts
  course.is_marks_published = true
  ```
- Optionally create audit row with `publish_type = "FULL"`.

### Student `/my-student-marks`

Return one latest published mark per course:
- Consider marks for the authenticated student.
- A mark is visible if its course has either:
  - `is_practical_marks_published = true`, or
  - `is_marks_published = true`
- Because marks can exist for multiple `academic_key`s, group by `course_id` and return the latest relevant one. Prefer current/latest by academic key or timestamp consistently; avoid duplicate rows for same course.
- If `course.is_marks_published` is false but `is_practical_marks_published` is true:
  - return practical grade
  - mask theoretical grade to `0`
  - total = practical
- If `course.is_marks_published` is true:
  - return practical + theoretical
  - total = practical + theoretical

### Semester reset note

At the start of a new semester, future work should set all course booleans back to false:

```ts
is_practical_marks_published = false
is_marks_published = false
```

That reset is not part of this task unless explicitly requested.
