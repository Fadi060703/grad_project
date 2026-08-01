# Backend Handoff Clarifications (cleaned transcript)

> This is the Zed agent thread "Backend Handoff Clarifications", cleaned up:
> all large auto-generated Prisma client dumps (`class.ts`, `prismaNamespace.ts`,
> `prismaNamespaceBrowser.ts`, `browser.ts`, `client.ts` internals, the giant
> `runtimeDataModel`/`parameterizationSchema`/`graph` JSON blobs, and repeated
> inline-schema string escapes) have been removed or replaced with short notes.
> All actual decisions, code excerpts from real controllers/validators, and the
> final handoff content are preserved in full.

---

## User (initial request)

0. add the photo_array logic to location CRUD (`src/controllers/locationsController.ts`) (get, update, create) — it is already in the prisma model.
1. add change password api that dashboard users (not students) can use, identical to the current change password api, different route and controller and validator (`src/router/student.routes.ts`).
2. add the functionality of changing a student's group — api, validator, logic (needs more discussion). It's more like rotating between 2 students: student A becomes group B, student B becomes group A.
3. make sure the announcements attachments are handled in the announcement CRUD (create/update/get) — just inform me.
4. add a way to publish the marks for a specific course (so admin only publishes that course's marks when sure all marks are there) — needs discussion to agree on how.

Do not code yet, do not make assumptions, do not guess, ask for clarifications if needed.

---

## Assistant — initial investigation

*(Searched the codebase for: `photo_array`, `UniversityLocation`, `attachments`, `change password`, `Mark`/`marks`/`publish`. Found and inspected the relevant Prisma model, controllers, and validators below.)*

### Relevant Prisma model excerpt (`schema.prisma`)

```prisma
model UniversityLocation {
  id                   Int            @id @default(autoincrement())
  name                 String         @unique
  reaching_description String?
  photo_array          String[]       @default([])
  created_at           DateTime       @default(now())
  updated_at           DateTime?      @updatedAt
  lectures             Lecture[]
  examSettings         ExamSettings[]

  @@map("university_locations")
}
```

```prisma
model Announcement {
  id          Int              @id @default(autoincrement())
  title       String
  content     String
  type        AnnouncementType @default(REGULAR)
  attachments String[]         @default([])
  // ... target audience fields (year/section/major/group/course/student, all optional)
  created_by  Int?
  creator     User?            @relation("AnnouncementCreator", fields: [created_by], references: [id], onDelete: SetNull)
  created_at  DateTime         @default(now())
  updated_at  DateTime         @updatedAt
}
```

```prisma
model Mark {
  id                Int       @id @default(autoincrement())
  course_id         Int
  course            Course    @relation(fields: [course_id], references: [id], onDelete: Cascade)
  student_id        Int
  student           Student   @relation(fields: [student_id], references: [student_id], onDelete: Cascade)
  practical_grade   Int
  theoretical_grade Int
  created_at        DateTime  @default(now())
  updated_at        DateTime? @updatedAt

  @@unique([course_id, student_id])
  @@index([course_id])
  @@index([student_id])
}
```

```prisma
model Student {
  student_id       Int       @id @default(autoincrement())
  userId           Int       @unique
  year_id          Int
  section_id       Int?
  major_id         Int?
  group_id         Int
  // Agreements enforced in app logic:
  // - Student must have exactly one of section_id or major_id (mutually exclusive)
  // - Student.year_id must match the Year of the chosen Section or Major
  // - group_id must belong to the same Section or Major as the student
}
```

```prisma
enum Role {
  ADMIN
  DOCTOR
  TEACHER
  STUDENT
  CONTENT_DE
  EXAMS_DE
  LECTURES_SCHEDULE_DE
  MARKS_DE
}
```

### `src/controllers/locationsController.ts` (existing CRUD, no photo_array handling yet)

- `getAllUniversityLocations` — list handler, selects `id, name, reaching_description, created_at, updated_at` (no `photo_array`).
- `getUniversityLocationById` — same, missing `photo_array`.
- `createUniversityLocation` — `data.name`, checks duplicate name, creates without `photo_array`.
- `updateUniversityLocation` — updates only `name` / `reaching_description`.
- `deleteUniversityLocation` — unaffected.

### `src/validators/locations.ts` (existing)

```ts
export const getUniversityLocationSchema = z.object({
  id: z.number().positive(),
  name: z.string(),
  reaching_description: z.string().optional().nullable(),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

export const createUniversityLocationSchema = z.object({
  name: z.string().min(2).max(100),
  reaching_description: z.string().optional().nullable()
});

export const updateUniversityLocationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  reaching_description: z.string().optional().nullable()
});
```

### `src/controllers/studentProfileController.ts` (existing student change-password, for reference)

```ts
export const changeMyStudentPassword = asyncHandler(async (req, res) => {
  const userId = getAuthStudentUserId(req);
  const data = changeStudentPasswordSchema.parse(req.body);

  const student = await prisma.student.findUnique({
    where: { userId },
    select: { user: { select: { id: true, role: true, password: true } } },
  });

  const isCurrentPasswordValid = await bcrypt.compare(data.current_password, student.user.password);
  if (!isCurrentPasswordValid) throw new BadRequestError("Current password is incorrect");

  const hashedPassword = await bcrypt.hash(data.new_password, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

  return res.status(200).json({ success: true, message: "Password changed successfully" });
});
```

### `src/validators/student-profile.ts` (existing, for reference)

```ts
const passwordSchema = z.string()
  .min(8).max(50)
  .regex(/[A-Z]/, "Must contain at least one Uppercase letter")
  .regex(/[a-z]/, "Must contain at least one Lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

export const changeStudentPasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: passwordSchema,
  confirm_password: z.string().min(1, "Confirm password is required"),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});
```

### `src/controllers/announcementController.ts` (existing, attachments already present)

- `createAnnouncement`: writes `attachments: data.attachments` into `prisma.announcement.create`.
- `updateAnnouncement`: conditionally updates `attachments` if provided.
- `getAllAnnouncements` / `getAnnouncementById` / `getUserAnnouncements`: return full Prisma announcement records (which include `attachments`).

### `src/validators/announcements.ts` (existing, attachments already present)

```ts
export const getAnnouncementSchema = z.object({
  // ...
  attachments: z.array(z.string()),
  // ...
});

export const createAnnouncementSchema = z.object({
  // ...
  attachments: z.array(z.string()).default([]),
});

export const updateAnnouncementSchema = z.object({
  // ...
  attachments: z.array(z.string()).optional(),
});
```

### `src/controllers/marksController.ts` / `src/validators/marks.ts` (existing, no publish concept yet)

```ts
const mapMark = (mark: any) => ({
  ...mark,
  total_grade: mark.practical_grade + mark.theoretical_grade,
});

export const getAllMarks = createListHandler({ /* select: id, course_id, course, student_id, student, practical_grade, theoretical_grade, created_at, updated_at */ });

export const getMyStudentMarks = createListHandler({ /* only STUDENT role, select: id, course_id, course, practical_grade, theoretical_grade, created_at, updated_at */ });

export const bulkCreateMarks = asyncHandler(async (req, res) => {
  const data = bulkCreateMarksSchema.parse(req.body);
  // rejects duplicate (course_id, student_id) pairs within the same request
  // validates courses/students exist, then creates Mark rows (no upsert logic yet)
});
```

```ts
// validators/marks.ts
const markItemSchema = z.object({
  course_id: z.number().positive(),
  student_id: z.number().positive(),
  practical_grade: z.number().int().min(0).max(100),
  theoretical_grade: z.number().int().min(0).max(100),
}).refine((data) => data.practical_grade + data.theoretical_grade <= 100, {
  message: "Sum of practical and theoretical grades must be <= 100",
  path: ["theoretical_grade"],
});

export const bulkCreateMarksSchema = z.object({
  marks: z.array(markItemSchema).min(1),
});

export const updateMarkSchema = z.object({
  course_id: z.number().positive().optional(),
  student_id: z.number().positive().optional(),
  practical_grade: z.number().int().min(0).max(100).optional(),
  theoretical_grade: z.number().int().min(0).max(100).optional(),
}).refine((data) => Object.values(data).some((v) => v !== undefined));

export const bulkDeleteMarksSchema = z.object({
  ids: z.array(z.number().positive()).min(1),
});
```

### Existing marks routes (`src/router/exam.routes.ts`)

```ts
router.get("/marks", authMiddleware, check("marks:read"), getAllMarks);
router.get("/my-student-marks", authMiddleware, check("student-marks:read"), getMyStudentMarks);
router.post("/marks/bulk-create", authMiddleware, check("marks:add"), bulkCreateMarks);
router.put("/marks/:id", authMiddleware, check("marks:update"), updateMark);
router.delete("/marks/bulk-delete", authMiddleware, check("marks:delete"), bulkDeleteMarks);
```

### `src/validators/settings.ts` (existing `SystemSettings`, for reference — will need `current_academic_key` added)

```ts
export const getSystemSettingsSchema = z.object({
  id: z.number().positive(),
  lecture_duration: z.number().int().positive().optional().nullable(),
  lectures_start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
  aided_pass_courses_number: z.number().int().min(0).optional().nullable(),
  aided_marks_number: z.number().int().min(0).optional().nullable(),
  theoretical_exam_date: z.string().datetime().or(z.date()).optional().nullable(),
  practical_exam_date: z.string().datetime().or(z.date()).optional().nullable(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});
```

---

## Assistant — clarification questions (round 1)

**0. Location `photo_array`**
1. Array of image URLs/paths as strings?
2. On create, if omitted, default to `[]`?
3. On update, replace whole array, or add/remove single photos?
4. Should get/list responses include `photo_array`?

**1. Dashboard change password**
5. Route preference? (`/dashboard/profile/change-password`, `/users/me/change-password`, other?)
6. Allowed roles = all non-students (`ADMIN, DOCTOR, TEACHER, CONTENT_DE, EXAMS_DE, LECTURES_SCHEDULE_DE, MARKS_DE`)?
7. Same body as student (`current_password`, `new_password`, `confirm_password`)?
8. Permission string for the route?

**2. Change/rotate student group**
9. Body receives two students directly (`student_a_id`, `student_b_id`) or one student + target group?
10. IDs are `Student.student_id`, not `User.id`, correct?
11. Swap only allowed if both students are same `year_id` and same `section_id`/`major_id`?
12. Both target groups also validated to belong to that same section/major?
13. Roles allowed — Admin only?
14. Preferred route?
15. Should existing attendance rows change too, or only `student.group_id`?
16. If future attendance rows already exist for weekly lectures, should we regenerate/swap them?

**3. Announcement attachments** — appears already fully implemented (Prisma model, both validators, both controllers, get/list responses). Asked: does "handle" mean file-upload support instead of string-array URLs?

**4. Publish marks per course**
17. OK with a Prisma migration?
18. Publish is per **course**, not per individual mark?
19. Should publishing expose both grades together?
20. Should admin be able to unpublish?
21. Where should publish state live — `Course` fields / separate model / `Mark` field?
22. Should student-facing marks APIs hide unpublished course marks until published?

---

## User — answers (round 1)

1. yes, it is already in the prisma
2. yes
3. yes, replace the whole array
4. yes
5. `/auth/change-password`
6. yes
7. yes
8. no permission
9. *(said to discuss, not yes/no — but leans yes, two students directly)*
10. yes
11. yes
12. yes
13. admin
14. good
15. only `group_id`
16. didn't understand
17. let's discuss the flow first (and where to put publishing status info)
18. probably
19. yes + total grade (all the mark stuff)
20. no (note: not only admin handles marks — also `MARKS_DE` / `EXAMS_DE`)
21. "let's investigate and explain each one, and what is your recommendation"
22. yes, that behavior logic is right

---

## Assistant — group swap recommendation

**Route:** `POST /students/swap-groups`

**Body:**
```json
{ "student_a_id": 1, "student_b_id": 2 }
```

**Logic:**
1. Admin only.
2. Load both students with `student_id, year_id, section_id, major_id, group_id`.
3. Reject same student.
4. Reject if either student not found.
5. Reject if same current group (no-op).
6. Validate same academic scope: same `year_id`, same `section_id`/`major_id`.
7. Validate both groups belong to that same section/major.
8. Transaction: swap only `student.group_id` for both.

**On attendance:** since the user said "only `group_id`", existing attendance rows are **not** touched. This means swaps affect future logic from the moment of swap onward; already-created attendance records for the old group remain as-is. (User later confirmed this is fine — see round 2 answer #5.)

---

## Assistant — marks publishing options (round 1 exploration)

Findings: `Mark` has no publish state; unique on `(course_id, student_id)`; student marks endpoint returns all marks unconditionally; marks routes gated by `marks:read/add/update/delete` permissions.

**Option A — publish fields on `Course`:** `marks_published_at`, `marks_published_by`. Simple, but only supports one lifetime publish per course (rejected later once re-publishing across semesters came up).

**Option B — separate `CourseMarksPublication` model:** history/audit friendly, more flexible, initially recommended for repeated publishing across semesters.

**Option C — `published_at` on each `Mark`:** rejected — bad fit, since publishing is a course-level decision ("all marks are there"), and per-row publishing risks partial/inconsistent state.

**Initial recommendation:** Option A, course-level, single publish only — but this was superseded once the user clarified marks get published multiple times per course across semesters/years (see below).

**Completeness rule proposed:** publish should require every enrolled student in the course to have a mark row (not just "at least one mark") — matches "when he is sure all marks are there."

**Proposed publish route (early draft, later changed):** `POST /marks/courses/:courseId/publish`.

---

## User — answers (round 2)

1. `/marks/courses/:courseId/publish-practical` / `-full` routing style: ok *(see final route names below)*
2. yes — allowed publish roles `ADMIN`, `MARKS_DE`, `EXAMS_DE`
3. yes — completeness rule: publish only if every enrolled student has a mark
4. For storage: **but** a course might publish its marks more than once (end of semester 1, semester 2, next year's semester 1, etc.) — asked Claude to pick the best design given this.
5. ok — group swap: fine that existing attendance rows are not changed.

---

## Assistant — revised recommendation (multi-publish support)

Since a course can be published multiple times across academic periods, **`Course.marks_published_at` (single lifetime flag) is insufficient.**

**Recommended: separate `CourseMarksPublication` model**, e.g.:

```prisma
model CourseMarksPublication {
  id           Int      @id @default(autoincrement())
  course_id    Int
  course       Course   @relation(fields: [course_id], references: [id], onDelete: Cascade)
  semester     Semester
  academic_key String   // e.g. "2026-FIRST"
  published_by Int
  published_at DateTime @default(now())

  @@unique([course_id, academic_key])
}
```

Why: supports repeated publishing per course over time, keeps a history/audit trail, avoids overwriting a single course-level timestamp.

Questions asked: (1) is `academic_key` already tracked somewhere or supplied manually? (2) should student marks show only the latest publication or current-semester-only marks? (3) are `Mark` rows overwritten each semester or stored historically?

**User answers:** (1) received manually. (2)/(3) user didn't understand the questions / didn't see the point — asked Claude to just explain the flow instead of asking abstract questions.

---

## User — key requirement clarification

"how will that affect `/my-student-marks`... if he failed and exams a second/third time in the same course and passes, I want the **last mark** for him in a specific course... in general I want the last mark for him in a specific course (not the same course with a lot of items)."

## Assistant — response

Good point: the **existing** `Mark` model already enforces `@@unique([course_id, student_id])`, so there is naturally only one current/latest mark per student per course — retries update the same row, they don't create duplicates.

So:
- `Mark` = latest/current mark per `(student_id, course_id)`.
- `CourseMarksPublication` just marks "marks for this course are now visible for academic period X."
- `/my-student-marks` returns the student's one latest mark per course, only if that course has at least one publication record.
- Do **not** filter student marks by `academic_key` (that would hide old marks) — use `academic_key` only for publish history/duplicate prevention on the publish side.

Asked: should re-publishing a course under a new `academic_key` simply make the updated latest marks visible while keeping old publication history? **User: yes.**

---

## User — new requirements (boolean flag + toggle + admin filtering)

- Add a boolean field on `Course`: `is_marks_published`, toggleable. At the start of each semester all such flags should auto-reset to `false` (to be implemented later). When marks are published it becomes `true`. This is for the frontend to know publish status.
- There should be an endpoint to manually toggle it.
- When the frontend (admin or DE) calls `getAllMarks`, they should **not** see previous-semester marks. Note: in the same semester, admin can publish practical marks for a course, then later publish full marks.
- Asked: "how to handle? short answer, any questions?"

## Assistant — response

Recommendation (draft, later refined further):
1. Keep `Mark` as one latest mark per student/course (`@@unique([course_id, student_id])`), so `/my-student-marks` never duplicates.
2. Add `academic_key` to `Mark`, so `getAllMarks` can filter by `?academic_key=2026-FIRST` to hide previous semesters.
3. Add `Course.is_marks_published Boolean @default(false)` for frontend/student visibility.
4. Add a `CourseMarksPublication` history model supporting `publish_type` (`PRACTICAL` / `FULL`), `published_by`, `published_at`.
5. Student marks visible only if `course.is_marks_published = true` and mark matches the relevant `academic_key`.

Asked: when practical marks are published before full marks, should students see only `practical_grade`, or theoretical as `0`/`null` until full publish?

## User — corrections

- Point 5 is wrong: student marks endpoint should return **all** his marks from before (all previous academic keys), not filtered to current semester.
- Didn't understand how the frontend will know the current academic key, and didn't understand why the new `CourseMarksPublication` model was added.
- Theoretical stays `0` until full publish (confirmed).

## Assistant — corrected recommendation

- `/my-student-marks` returns **all published marks across all academic keys** (not just current semester); admin `/marks` can filter by `academic_key` to avoid old-semester noise.
- **How frontend knows `academic_key`:** for now, publish endpoint / admin marks list receive it manually (query param or dropdown selection in the UI). Later, add `current_academic_key` to `SystemSettings` so the backend can expose/default it.
- **Why `CourseMarksPublication`:** at that point, only useful for history/audit (who published what, when) — visibility itself doesn't strictly need it.
- Proposed (then revised) design: add `Mark.academic_key`, `Mark.is_practical_published`, `Mark.is_full_published`, unique on `(course_id, student_id, academic_key)`, plus `Course.is_marks_published` as a simple current-semester status flag. Recommended **skipping** `CourseMarksPublication` unless audit history is specifically required.

---

## User — final corrections before the flow write-up

- Confirmed: `/my-student-marks` returns all published marks from all previous academic keys, but still **only the latest mark of each course** (as agreed).
- **Add `current_academic_key` to `SystemSettings` now**, and handle its controllers/validators.
- **No flags on `Mark`** — "didn't we already agree there is no flags on the Mark (you told me yourself there are cons)!!"
- Asked Claude to just describe the flow/scenario (a specific course from start of semester to full marks published) — what the backend does and how records change at each step.

## Assistant — final flow (with corrected "no flags on Mark")

Acknowledged the `Mark` flags contradiction was a mistake.

**Models/fields (final at this stage):**
- `SystemSettings.current_academic_key` (e.g. `"2026-FIRST"`)
- `Course.is_marks_published` — simple frontend/current-semester status, reset to `false` at semester start (future work)
- `Mark.academic_key` — marks stored per course/student/academic period; unique becomes `@@unique([course_id, student_id, academic_key])`
- `CourseMarksPublication` — source of truth for what was published: `course_id, academic_key, publish_type (PRACTICAL|FULL), published_by, published_at`

**Scenario walkthrough:**
1. **Start of semester** — `systemSettings.current_academic_key = "2026-FIRST"`, `course.is_marks_published = false`, no `Mark` rows yet for this course/key. Old marks from previous semesters remain in DB untouched.
2. **Admin/DE enters practical marks** — `bulkCreateMarks` creates/updates `Mark` rows tagged with the current `academic_key` (e.g. `practical_grade: 18, theoretical_grade: 0`). No `CourseMarksPublication` yet; student can't see it yet; admin `/marks` defaults to current `academic_key`.
3. **Admin publishes practical marks** — creates a `CourseMarksPublication` row with `publish_type: "PRACTICAL"`. `Course.is_marks_published` could flip true here (later refined into two separate booleans — see final requirements). Student now sees the course, but theoretical is masked to `0`.
4. **Full marks later entered** — same `Mark` rows updated (e.g. `theoretical_grade: 65`) for the same course/student/key, but student still sees masked `0` because `FULL` isn't published yet.
5. **Admin publishes full marks** — creates a `CourseMarksPublication` row with `publish_type: "FULL"`. Student now sees full grades and total.

**`/my-student-marks` logic:** return marks that have at least one matching `CourseMarksPublication`; group by `course_id`; pick the latest published academic key per course; mask theoretical to `0` if latest publication type is `PRACTICAL`, else return full grades.

**`/marks` (admin) logic:** default to `academic_key = systemSettings.current_academic_key`; optional override via `?academic_key=...`.

Asked: should `Course.is_marks_published` become true after practical publish, or only after full publish?

---

## User — final requirements (this is what got handed off)

1. Add **`is_practical_marks_published`** to `Course` — becomes `true` after practical publish.
2. Make **two separate publish APIs**: publish-practical and publish-full. Flow for admin/DE:
   - First opens the marks page → table is empty (both flags false).
   - Adds marks via `bulkCreateMarks`.
   - Clicks "Publish" → calls **publish-practical** → `is_practical_marks_published = true`.
   - Reopens the page → marks now appear.
   - Calls `bulkCreateMarks` again — **must upsert**: update the existing mark if `academic_key + student_id + course_id` match, otherwise create it.
   - After finishing → clicks the same "Publish" button, which now calls **publish-full** → `is_marks_published = true`.

Explicitly said: **do not write the handoff md yet** at this point — asked if there are any questions first.

## Assistant — clarification questions (round 3)

1. Confirmed upsert key should be `academic_key + student_id + course_id` (not `mark_id`) — is that right?
2. Should `bulkCreateMarks` get `academic_key` from the request body, or from `systemSettings.current_academic_key` automatically?
3. When both flags are false, should `getAllMarks` really return empty even if draft marks already exist, or should admin/DE always see drafts (only students blocked)?
4. Route names ok? `POST /marks/courses/:courseId/publish-practical`, `POST /marks/courses/:courseId/publish-full`?
5. Practical publish completeness: require every enrolled student to have a practical mark?
6. Full publish completeness: require every enrolled student to have both practical + theoretical?
7. Confirm: practical publish sets `course.is_practical_marks_published = true`; full publish sets `course.is_marks_published = true`?
8. Confirm student `/my-student-marks` masking behavior (practical-only → theoretical `0`, total = practical; full → both + total)?

## User — final answers

1. yes (course_id, not mark_id)
2. from `SystemSettings.current_academic_key` automatically
3. no — `getAllMarks` should return the **draft marks related to the current academic key** (not empty); the point of "empty at first" was just that no marks exist yet for a fresh semester, not that the API should hide drafts
4. ok
5. yes
6. yes — the grade might be `0`, but there must be a mark **record**; that's what "complete" means
7. yes
8. yes

Confirmed: no further questions.

---

## User — handoff request

"now write the handoff.md file — it should contain all the needed details you gathered about the 5 tasks (that are not implemented yet) (starting from photo array location task) — it should point at the needed files for context so the agent does not waste all tokens — the file should not be very big — make it organized."

---

## Assistant — final `handoff.md` (delivered content, verbatim)

```markdown
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
  - A gets B's old group
  - B gets A's old group
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
```

---

## Assistant — closing note

Created `grad_project_hani/handoff.md` with the organized handoff for all 5 pending tasks, including relevant context files and the agreed marks publishing flow.

> **Note on the round-3 clarification (item 3, "draft marks not empty"):** the final answer from the user
> corrects the `handoff.md` text above ("If no marks exist for the current academic key, return empty
> table") — the intent is that `getAllMarks` returns whatever draft marks exist for the current
> `academic_key` (which is naturally empty at the very start of a semester, before any marks are
> entered), not that the API deliberately hides drafts. Worth double-checking this nuance against the
> `handoff.md` wording when implementing.