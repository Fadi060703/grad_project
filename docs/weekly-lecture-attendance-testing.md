# Weekly lecture attendance testing guide

This guide explains how to test the weekly lecture, publish QR, cancel/restore, and attendance flow before building the production frontend.

## Intended behavior summary

- `lectures` is the repeated weekly schedule template.
- `weekly_lectures` is the generated real lecture instance with an actual date.
- Weekly generation creates Sunday → Thursday instances for the next academic week.
- Student next lecture matching:
  - `PRACTICAL`: match by the student's `group_id`.
  - `THEORETICAL`: match by the student's `section_id` or `major_id`.
- Finished lectures are skipped.
- Cancelled lectures are skipped.
- Teachers can publish only their own ongoing practical lecture.
- Doctors cannot publish lectures.
- Publishing creates/returns a static QR token for that weekly lecture.
- Publishing is idempotent: publishing again returns the same QR token.
- Publishing creates attendance rows for all students currently in the practical lecture group.
- Students mark attendance using their auth token and the QR payload.
- Teachers can cancel/restore their own practical lecture only before start time.
- Doctors can cancel/restore their own theoretical lecture only before start time.
- Published lectures cannot be cancelled.

## Temporary quick setup endpoint

For quick testing with the static records currently configured in the backend, call this open temporary endpoint:

```http
POST /api/dev/prepare-attendance-test
```

It uses this static data:

```txt
student_id: 1
student user_id: 32
student group_id: 1
student section_id: 1
teacher user_id: 13
practical lecture_id: 25
doctor user_id: 2
theoretical lecture_id: 1
```

It will:

- set `system_settings.lectures_start_time` to about 10 minutes from now
- set `system_settings.lecture_duration` to `90`
- set practical lecture `25` to `time_box_order = 1`
- set theoretical lecture `1` to `time_box_order = 2`
- delete old test weekly lecture rows for those two lectures on the test date
- create fresh `DRAFT` weekly lecture rows
- return the new weekly lecture IDs and start/end windows

Use this only for local/dev testing. It is open and must be removed before production.

## Required data setup

Before testing, make sure the database has:

1. `system_settings` row with:
   - `lectures_start_time`, for example `08:00`
   - `lecture_duration`, for example `90`
2. At least one active teacher user.
3. At least one active doctor user.
4. At least one student user with a `Student` row.
5. A practical `Lecture`:
   - `lecture_type = PRACTICAL`
   - `instructor_id` points to the teacher user
   - `group_id` points to the student's group
   - scheduled for a day/time you can test
6. A theoretical `Lecture`:
   - `lecture_type = THEORETICAL`
   - `instructor_id` points to the doctor user
   - `section_id` or `major_id` matches the student
7. Generated `weekly_lectures` rows for the current/upcoming test week.

## Generate weekly lectures

If you are using the temporary quick setup endpoint above, you can skip this generation step for the two static test lectures.

Login as a user with `weekly-lectures:generate` permission, usually admin or teacher.

```http
POST /api/cron/generate-weekly-lectures
Authorization: Bearer <token>
```

Expected response:

```json
{
  "success": true,
  "message": "12 weekly lectures generated.",
  "data": {
    "week_start": "2026-08-09",
    "week_end": "2026-08-13",
    "created": 12,
    "skipped_existing": 0
  }
}
```

Running the endpoint again should not duplicate rows. `created` should become `0` and `skipped_existing` should increase.

## Login and collect tokens

Use the login endpoint for teacher, doctor, and student accounts:

```http
POST /api/auth/login
Content-Type: application/json

{
  "userName": "teacher_username",
  "password": "teacher_password"
}
```

Copy:

```json
{
  "data": {
    "access": "<token>"
  }
}
```

Repeat for:

- teacher token
- doctor token
- student token

## Open the test page

The backend serves the test page at both:

```txt
http://localhost:8001/attendance-test.html
http://localhost:8001/api/attendance-test.html
```

For two-device QR testing, expose the backend with ngrok:

```txt
https://abc123.ngrok-free.app/attendance-test.html
```

Use the same ngrok base URL in the page's `API base URL` field:

```txt
https://abc123.ngrok-free.app
```

Recommended setup:

- Laptop browser: teacher tab, display QR.
- Phone browser: student tab, scan QR.

Camera access usually requires HTTPS, so ngrok is recommended for phone scanning.

## Test teacher practical publish flow

1. Open `attendance-test.html`.
2. Paste the API base URL.
3. Paste the teacher token.
4. Go to `Teacher practical` tab.
5. Click `Get teacher next lecture`.
6. Verify the loaded lecture:
   - `Type: PRACTICAL`
   - `Status: DRAFT` or `PUBLISHED`
   - `Ongoing: true`
   - `Can publish: true`
7. Click `Publish / show QR`.
8. Expected result:
   - QR appears.
   - Response has `status = PUBLISHED`.
   - Response has `qr_string`.
   - Attendance rows are created for group students.

If you click publish again during the same lecture window, the same QR token should be returned.

## Test student scan flow

1. On the phone, open the test page using the HTTPS ngrok URL.
2. Paste the same API base URL.
3. Paste the student token.
4. Go to `Student scan` tab.
5. Click `Get student next lecture`.
6. Verify:
   - Practical lecture appears.
   - `Status: PUBLISHED`
   - `Ongoing: true`
   - `Can scan QR: true`
   - `Has attended: false`
7. Click `Start camera scan`.
8. Scan the teacher QR.
9. Expected result:
   - `Attendance marked successfully`.
   - Reloading next student lecture should show `Has attended: true` if the same lecture is still ongoing.

If camera scanning is not available, copy the QR payload shown under the QR and paste it into `Manual QR payload`, then click `Submit pasted QR payload`.

Example QR payload:

```json
{
  "weekly_lecture_id": 123,
  "qr_string": "e21d0b9b-9bbf-4e0b-967e-3ff6f724344f"
}
```

## Test duplicate attendance prevention

After a successful student scan, submit the same QR again.

Expected response:

```txt
Attendance already marked for this student
```

## Test wrong student/group rejection

Login with a student from a different group and scan the practical lecture QR.

Expected response:

```txt
Student does not belong to this lecture's group
```

## Test QR time-window rejection

Try to publish or scan outside the lecture time window.

Expected publish response:

```txt
QR can only be generated during the lecture window (...)
```

Expected scan response:

```txt
QR code is only valid during the lecture window (...)
```

## Test teacher cancellation

Cancellation is only allowed before the lecture starts.

1. Use a future practical weekly lecture assigned to the teacher.
2. In the teacher tab, click `Get teacher next lecture`.
3. Verify:
   - `Status: DRAFT`
   - `Can cancel: true`
4. Click `Cancel / restore`.
5. Expected:
   - Status becomes `CANCELLED`.
   - Student next lecture should skip this cancelled practical lecture.
6. To restore, use the manual weekly lecture ID override because cancelled lectures are skipped by `next` endpoints.

Published practical lectures cannot be cancelled.

## Test doctor theoretical cancellation

1. Paste the doctor token.
2. Go to `Doctor theoretical` tab.
3. Click `Get doctor next lecture`.
4. Verify:
   - `Type: THEORETICAL`
   - `Status: DRAFT`
   - `Can cancel: true`
5. Click `Cancel / restore`.
6. Expected:
   - Status becomes `CANCELLED`.
   - Student next lecture should skip this theoretical lecture.

Doctors cannot publish theoretical lectures. Theoretical lectures should only be `DRAFT` or `CANCELLED`.

## API endpoints used by the frontend

### Generate weekly lectures

```http
POST /api/cron/generate-weekly-lectures
Authorization: Bearer <admin-or-allowed-token>
```

### Get next teacher lecture

```http
GET /api/weekly-lectures/next/teacher
Authorization: Bearer <teacher-token>
```

### Get next doctor lecture

```http
GET /api/weekly-lectures/next/doctor
Authorization: Bearer <doctor-token>
```

### Get next student lecture

```http
GET /api/weekly-lectures/next/student
Authorization: Bearer <student-token>
```

### Publish practical lecture

```http
POST /api/weekly-lectures/:id/publish
Authorization: Bearer <teacher-token>
```

### Cancel or restore weekly lecture

```http
POST /api/weekly-lectures/:id/toggle-cancel
Authorization: Bearer <teacher-or-doctor-token>
```

### Mark attendance

```http
POST /api/attendance/mark
Authorization: Bearer <student-token>
Content-Type: application/json

{
  "weekly_lecture_id": 123,
  "qr_string": "e21d0b9b-9bbf-4e0b-967e-3ff6f724344f"
}
```

Do not send `student_id`; the backend resolves the student from the token.

## Common failures

| Symptom | Likely cause |
|---|---|
| `UNAUTHORIZED` | Missing/expired token or wrong token field in test page |
| `UNAUTHORIZED Or Don't Have Permission` | Role lacks required permission |
| Publish button disabled | Lecture is not ongoing, not practical, cancelled, or not loaded |
| Scan button disabled | Student next lecture is not published/ongoing or student already attended |
| Camera does not open | Page is not served over HTTPS or browser permission denied |
| `No attendance record found` | Lecture was not published after attendance-row creation logic, or student was added after publish |
| `Student does not belong to this lecture's group` | Student token belongs to a student outside the practical lecture group |
| The expected lecture does not appear | Weekly lectures not generated, lecture finished, cancelled, or student target data does not match |
