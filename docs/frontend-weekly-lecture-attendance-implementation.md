# Frontend implementation notes: weekly lectures and attendance

This file is for the frontend agent/dev. Each role section can be implemented independently.

## Shared rules

Base API path:

```txt
/api
```

All production endpoints below require:

```http
Authorization: Bearer <access-token>
```

Do not use `student_id` from the frontend for attendance. The backend gets the student from the token.

Weekly lecture response usually includes:

```ts
{
  id: number; // weekly_lecture_id
  lecture_id: number;
  lecture_date: string;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  qr_string: string | null;
  published_at: string | null;
  slot_start: string;
  slot_end: string;
  is_ongoing: boolean;
  can_publish?: boolean;
  can_cancel?: boolean;
  can_restore?: boolean;
  can_scan_qr?: boolean;
  has_attended?: boolean | null;
  lecture: {
    lecture_type: "THEORETICAL" | "PRACTICAL";
    time_box_order: number;
    course: { id: number; name: string; course_type: string };
    location: { id: number; name: string };
    instructor: { id: number; full_name: string; role: string };
    group?: { id: number; name: string } | null;
    section?: { id: number; name: string } | null;
    major?: { id: number; name: string } | null;
  };
}
```

Use backend flags when deciding UI state. Do not recalculate permissions only on the frontend.

---

# 1. Doctor implementation

Doctors only manage theoretical weekly lectures.

## Endpoints

### Get next doctor lecture

```http
GET /api/weekly-lectures/next/doctor
Authorization: Bearer <doctor-token>
```

Returns either:

```json
{ "success": true, "data": null }
```

or the next theoretical weekly lecture.

### Cancel / restore doctor lecture

```http
POST /api/weekly-lectures/:weeklyLectureId/toggle-cancel
Authorization: Bearer <doctor-token>
```

## UI behavior

Show doctor next lecture card with:

- course name
- location
- section or major
- date
- start/end time from `slot_start` / `slot_end`
- status

## Buttons

### `Cancel lecture`

Show/enable only when:

```ts
lecture.can_cancel === true
```

Meaning:

- lecture is assigned to this doctor
- lecture is theoretical
- lecture has not started yet
- lecture is not published
- status is `DRAFT`

### `Restore lecture`

Show/enable only when:

```ts
lecture.can_restore === true
```

Important: cancelled lectures are skipped by the normal `next` endpoint. If the UI needs restore after cancellation, either keep the cancelled lecture in local state after toggling, or provide an admin/dev view later.

### No publish button

Doctors must never see a publish/QR button. Theoretical lectures can only be:

```txt
DRAFT or CANCELLED
```

---

# 2. Teacher implementation

Teachers manage practical weekly lectures and QR publishing.

## Endpoints

### Get next teacher lecture

```http
GET /api/weekly-lectures/next/teacher
Authorization: Bearer <teacher-token>
```

Returns the teacher's next practical weekly lecture, or `data: null`.

### Publish practical lecture

```http
POST /api/weekly-lectures/:weeklyLectureId/publish
Authorization: Bearer <teacher-token>
```

No request body needed.

Successful response includes:

```ts
{
  qr_string: string;
  status: "PUBLISHED";
  eligible_students: number;
  attendance_records_created: number;
}
```

Publishing is idempotent. If already published, backend returns the same QR string.

### Cancel / restore practical lecture

```http
POST /api/weekly-lectures/:weeklyLectureId/toggle-cancel
Authorization: Bearer <teacher-token>
```

## UI behavior

Show teacher next lecture card with:

- course name
- group name
- location
- date
- start/end time from `slot_start` / `slot_end`
- status
- attendance setup counts after publish

## Buttons

### `Publish QR`

Show/enable only when:

```ts
lecture.can_publish === true
```

Meaning:

- logged-in user is the assigned teacher
- lecture is practical
- lecture is not cancelled
- current time is between `slot_start` and `slot_end`

Disable/hide when:

- lecture is not ongoing
- lecture is cancelled
- lecture is theoretical
- no next lecture exists

After publish succeeds:

- render QR code
- keep showing same QR if user refreshes/publishes again
- QR payload must be exactly:

```json
{
  "weekly_lecture_id": 123,
  "qr_string": "uuid-token"
}
```

### `Cancel lecture`

Show/enable only when:

```ts
lecture.can_cancel === true
```

Meaning:

- practical lecture
- assigned to logged-in teacher
- status is `DRAFT`
- lecture has not started yet

### `Restore lecture`

Show/enable only when:

```ts
lecture.can_restore === true
```

### Published lecture rule

A published lecture cannot be cancelled.

---

# 3. Student implementation

Students see their next theoretical or practical lecture. They can scan QR only for published practical lectures.

## Endpoints

### Get next student lecture

```http
GET /api/weekly-lectures/next/student
Authorization: Bearer <student-token>
```

Backend matching rules:

- practical lectures match by student's `group_id`
- theoretical lectures match by student's `section_id` or `major_id`
- cancelled lectures are skipped
- finished lectures are skipped

### Mark attendance

```http
POST /api/attendance/mark
Authorization: Bearer <student-token>
Content-Type: application/json

{
  "weekly_lecture_id": 123,
  "qr_string": "uuid-token"
}
```

Do not send `student_id`.

## UI behavior

Show student next lecture card with:

- course name
- lecture type
- group/section/major
- location
- instructor
- date
- start/end time from `slot_start` / `slot_end`
- status
- `has_attended` for practical lectures

## Buttons

### `Scan QR`

Show/enable only when:

```ts
lecture.can_scan_qr === true
```

Meaning:

- next lecture is practical
- status is `PUBLISHED`
- lecture is currently ongoing
- student has not already attended

Hide/disable when:

- no next lecture exists
- lecture is theoretical
- lecture is draft
- lecture is cancelled
- lecture is not currently ongoing
- `has_attended === true`

After successful scan:

- call `POST /api/attendance/mark`
- show success message
- refresh `GET /api/weekly-lectures/next/student`

Expected duplicate scan error:

```txt
Attendance already marked for this student
```

---

# QR scanner implementation warnings

These are important because the test HTML failed before because of these issues.

## Camera requirements

Phone camera usually requires a secure context:

```txt
HTTPS URL, for example ngrok
```

Do not rely on `file://` pages for mobile camera testing.

## Load QR library reliably

Do not depend on one CDN only. Either bundle the scanner library in the app build or add fallbacks.

Recommended library:

```txt
jsQR
```

If using browser `BarcodeDetector`, still keep `jsQR` as fallback. Some phones expose `BarcodeDetector` but fail to detect QR from video reliably.

## Start video correctly

After `getUserMedia`, call:

```ts
video.srcObject = stream;
await video.play();
```

Then scan frames using `requestAnimationFrame`, not only `setInterval`.

## Detection tips

If scanner opens but does not detect:

- make QR bigger
- increase screen brightness
- reduce glare
- keep the full QR inside the frame
- keep phone steady for 2–3 seconds

## Manual fallback

For dev/testing, keep a fallback input where the tester can paste the QR payload manually:

```json
{
  "weekly_lecture_id": 123,
  "qr_string": "uuid-token"
}
```

This verifies backend attendance even if mobile camera detection fails.

---

# Temporary dev endpoint

For backend testing only, there is a temporary open endpoint:

```http
POST /api/dev/prepare-attendance-test
```

It prepares static test weekly lectures and timing. Do not call or expose this in production frontend. It must be removed before production.
