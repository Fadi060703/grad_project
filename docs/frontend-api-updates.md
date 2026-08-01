# Frontend API Updates

This document lists the new endpoints and existing endpoint behavior/response changes from the backend update.

## New endpoints

### `PUT /auth/change-password`

Dashboard user password change. This endpoint is not for students.

**Auth:** required  
**Allowed roles:** `ADMIN`, `DOCTOR`, `TEACHER`, `CONTENT_DE`, `EXAMS_DE`, `LECTURES_SCHEDULE_DE`, `MARKS_DE`  
**Permission middleware:** none

#### Body

```json
{
  "current_password": "OldPass123",
  "new_password": "NewPass123",
  "confirm_password": "NewPass123"
}
```

Password rules:

- 8-50 characters
- at least one uppercase letter
- at least one lowercase letter
- at least one number
- `confirm_password` must match `new_password`

#### Success response

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### Possible errors

- `400` — current password is incorrect
- `403` — authenticated user is a student
- `404` — authenticated user was not found
- validation error — password/body validation failed

---

### `POST /students/swap-groups`

Admin-only endpoint to swap groups between two students.

**Auth:** required  
**Allowed roles:** `ADMIN`

#### Body

```json
{
  "student_a_id": 1,
  "student_b_id": 2
}
```

IDs are `Student.student_id`, not `User.id`.

#### Success response

```json
{
  "success": true,
  "message": "Student groups swapped successfully",
  "data": {
    "student_a": {
      "student_id": 1,
      "old_group_id": 10,
      "new_group_id": 20
    },
    "student_b": {
      "student_id": 2,
      "old_group_id": 20,
      "new_group_id": 10
    }
  }
}
```

#### Possible errors

- `400` — same student was provided
- `400` — students are already in the same group
- `400` — students are not in the same year
- `400` — students are not in the same section/major scope
- `400` — a student's current group does not match their section/major/year scope
- `403` — authenticated user is not an admin
- `404` — one or both students were not found

Notes:

- Only `student.group_id` is changed.
- Attendance rows and historical data are not modified.

---

### `POST /marks/courses/:courseId/publish-practical`

Publishes practical marks for the current academic key.

**Auth:** required  
**Allowed roles:** `ADMIN`, `MARKS_DE`, `EXAMS_DE`

#### Params

| Param | Type | Description |
|---|---:|---|
| `courseId` | number | Course ID |

#### Body

No body required.

#### Success response

```json
{
  "success": true,
  "message": "Practical marks published successfully",
  "data": {
    "course": {
      "id": 5,
      "is_practical_marks_published": true,
      "is_marks_published": false
    },
    "publication": {
      "id": 1,
      "course_id": 5,
      "academic_key": "2026-FIRST",
      "publish_type": "PRACTICAL",
      "published_by": 3,
      "published_at": "2026-08-01T12:00:00.000Z",
      "created_at": "2026-08-01T12:00:00.000Z",
      "updated_at": null
    }
  }
}
```

If `SystemSettings.current_academic_key` is missing/null, backend uses an empty string `""` as the academic key.

#### Possible errors

- `400` — invalid `courseId`
- `400` — not every student attached to the course has a mark record for the current academic key
- `403` — role is not allowed to publish marks
- `404` — course was not found
- `409` — practical marks are already published for this course/key
- `409` — full marks are already published for this course/key

---

### `POST /marks/courses/:courseId/publish-full`

Publishes full marks for the current academic key.

**Auth:** required  
**Allowed roles:** `ADMIN`, `MARKS_DE`, `EXAMS_DE`

`publish-full` can be called directly without publishing practical first. It sets both course flags to `true`.

#### Params

| Param | Type | Description |
|---|---:|---|
| `courseId` | number | Course ID |

#### Body

No body required.

#### Success response

```json
{
  "success": true,
  "message": "Full marks published successfully",
  "data": {
    "course": {
      "id": 5,
      "is_practical_marks_published": true,
      "is_marks_published": true
    },
    "publication": {
      "id": 1,
      "course_id": 5,
      "academic_key": "2026-FIRST",
      "publish_type": "FULL",
      "published_by": 3,
      "published_at": "2026-08-01T12:30:00.000Z",
      "created_at": "2026-08-01T12:00:00.000Z",
      "updated_at": "2026-08-01T12:30:00.000Z"
    }
  }
}
```

If a practical publication already exists for the same course/key, this endpoint updates that publication record from `PRACTICAL` to `FULL` and updates `published_at`.

If `SystemSettings.current_academic_key` is missing/null, backend uses an empty string `""` as the academic key.

#### Possible errors

- `400` — invalid `courseId`
- `400` — not every student attached to the course has a mark record for the current academic key
- `403` — role is not allowed to publish marks
- `404` — course was not found
- `409` — full marks are already published for this course/key

---

## Existing endpoints with changed behavior or response fields

### Locations endpoints

Affected endpoints:

- `GET /locations`
- `GET /locations/:id`
- `POST /locations`
- `PUT /locations/:id`

#### Behavior changed

Locations now support `photo_array` as an array of image URLs/paths.

- Create accepts optional `photo_array`.
- If omitted, it defaults to `[]`.
- Update replaces the whole array when `photo_array` is provided.
- Empty strings are ignored by backend.

#### Added request field

```json
{
  "photo_array": ["/uploads/location-1.png", "https://example.com/image.jpg"]
}
```

#### Added response field

```json
{
  "id": 1,
  "name": "Main Hall",
  "reaching_description": "Near the main gate",
  "photo_array": ["/uploads/location-1.png"],
  "created_at": "2026-08-01T12:00:00.000Z",
  "updated_at": "2026-08-01T12:00:00.000Z"
}
```

---

### `GET /system-settings` / `PUT /system-settings`

#### Added field

```json
{
  "current_academic_key": "2026-FIRST"
}
```

This key is used automatically by mark upload and publish APIs. If missing/null, backend treats it as `""`.

---

### Course responses

Affected endpoints include course list/detail and user/student course endpoints that return course objects.

#### Added response fields

```json
{
  "is_practical_marks_published": false,
  "is_marks_published": false
}
```

These flags represent the current course publish status for frontend display.

---

### `POST /marks/bulk-create`

#### Behavior changed

- Backend automatically uses `SystemSettings.current_academic_key`.
- If `current_academic_key` is missing/null, backend uses `""`.
- Marks are now upserted by:
  - `course_id`
  - `student_id`
  - `academic_key`
- If a matching mark exists, grades are updated.
- If no matching mark exists, it is created.
- `theoretical_grade` is optional and defaults to `0`.

#### Body

```json
{
  "marks": [
    {
      "course_id": 5,
      "student_id": 1,
      "practical_grade": 20
    },
    {
      "course_id": 5,
      "student_id": 2,
      "practical_grade": 18,
      "theoretical_grade": 65
    }
  ]
}
```

#### Success response

```json
{
  "count": 2,
  "message": "Marks upserted successfully"
}
```

---

### `GET /marks`

#### Behavior changed

- Defaults to marks for `SystemSettings.current_academic_key`.
- If `current_academic_key` is missing/null, defaults to `""`.
- Dashboard can override with query param:

```http
GET /marks?academic_key=2025-FIRST
```

Dashboard users can see draft marks before publish.

#### Added query

| Query | Type | Required | Description |
|---|---|---:|---|
| `academic_key` | string | no | Overrides the default current academic key filter |

#### Added response field

Each mark now includes:

```json
{
  "academic_key": "2026-FIRST"
}
```

The nested `course` object also includes:

```json
{
  "is_practical_marks_published": true,
  "is_marks_published": false
}
```

---

### `GET /my-student-marks`

#### Behavior changed

Frontend calls this endpoint the same way as before.

Backend now returns only marks from published course/key records:

- If latest publication for a course is `PRACTICAL`:
  - `theoretical_grade` is returned as `0`
  - `total_grade = practical_grade`
- If latest publication for a course is `FULL`:
  - practical + theoretical are returned normally
  - `total_grade = practical_grade + theoretical_grade`
- If the student has multiple published marks for the same course across academic keys, only the one with the most recent publication date is returned.

#### Added response field

Each mark now includes:

```json
{
  "academic_key": "2026-FIRST"
}
```

The nested `course` object also includes:

```json
{
  "is_practical_marks_published": true,
  "is_marks_published": true
}
```

---

## Notes

- Announcement attachments were already supported as `string[]`; no endpoint usage changed.
- There is no manual publish toggle endpoint.
- Old existing marks are deleted by the new database migration before adding `academic_key`.
