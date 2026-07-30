# Time-Conditioned Student APIs

## Overview

These APIs let the student frontend show the correct academic content based on the current date.

The backend checks `system_settings` exam dates and decides the current phase:

1. **Lecture phase**: before `practical_exam_date - 1 week`
2. **Practical exam phase**: from `practical_exam_date - 1 week` until before `theoretical_exam_date - 1 week`
3. **Theoretical exam phase**: from `theoretical_exam_date - 1 week` onward

If exam dates are missing from system settings, the backend falls back to lecture phase.

All APIs return a discriminator in `data.item_type` so the frontend knows what UI to render.

Possible `item_type` values:

```ts
"lecture" | "practical_exam" | "theoretical_exam"
```

All endpoints require student authentication.

---

## 1. Get Next Item

Returns the single next item for the current phase.

```http
GET /time-conditioned/next-item
```

### Auth

```http
Authorization: Bearer <student-token>
```

### Params

None.

### Query

None.

### Response

```ts
{
  success: true,
  data: {
    item_type: "lecture" | "practical_exam" | "theoretical_exam",
    item: LectureItem | ExamItem | null
  }
}
```

### Lecture item

When `item_type === "lecture"`, `item` is the same object returned by the existing student next lecture API.

Important extra fields:

```ts
{
  slot_start: string,
  slot_end: string,
  is_ongoing: boolean,
  has_attended: boolean | null,
  can_scan_qr: boolean
}
```

### Exam item

When `item_type` is `"practical_exam"` or `"theoretical_exam"`:

```ts
{
  id: number,
  type: "PRACTICAL" | "THEORETICAL",
  status: "READY" | "PUBLISHED",
  course_id: number,
  course: {
    id: number,
    name: string,
    code: string | null,
    image: string | null
  },
  setting: {
    id: number,
    exam_id: number,
    date: string,
    start_time: string,
    end_time: string,
    location: {
      id: number,
      name: string,
      reaching_description: string | null
    } | null
  }
}
```

---

## 2. Get Mini Schedule

Used under the next item card. Returns a compact schedule for the current phase.

```http
GET /time-conditioned/mini-schedule
```

### Auth

```http
Authorization: Bearer <student-token>
```

### Params

None.

### Query

None.

### Response

```ts
{
  success: true,
  data: {
    item_type: "lecture" | "practical_exam" | "theoretical_exam",
    day?: {
      name: string,
      date: string
    } | null,
    items: Array<LectureMiniItem | ExamScheduleItem>
  }
}
```

### Lecture phase behavior

When `item_type === "lecture"`, the API returns all student weekly lectures for the next calendar day that has lectures, starting from today.

The `day` object tells the frontend which day is being shown.

```ts
{
  item_type: "lecture",
  day: {
    name: "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY",
    date: string
  },
  items: LectureMiniItem[]
}
```

Each lecture item contains the weekly lecture data, nested lecture data, and:

```ts
{
  slot_start: string,
  slot_end: string,
  item_status: "finished" | "ongoing" | "upcoming"
}
```

### Exam phase behavior

When `item_type` is `"practical_exam"` or `"theoretical_exam"`, the API returns the full assigned exam schedule for the student.

```ts
{
  item_type: "practical_exam" | "theoretical_exam",
  items: ExamScheduleItem[]
}
```

Each exam item has the same shape as `ExamItem`, plus:

```ts
{
  item_status: "finished" | "today" | "upcoming"
}
```

---

## 3. Get Schedule

Used by the full schedule page. Returns the schedule for the current phase.

```http
GET /time-conditioned/schedule
```

### Auth

```http
Authorization: Bearer <student-token>
```

### Params

None.

### Query

None.

### Response

```ts
{
  success: true,
  data: {
    item_type: "lecture" | "practical_exam" | "theoretical_exam",
    items: Array<LectureScheduleItem | ExamScheduleItem>
  }
}
```

### Lecture phase behavior

When `item_type === "lecture"`, data is fetched from `lectures`, not `weekly_lectures`.

It returns only lectures related to the authenticated student, matching by:

- practical lectures: `course_id` + `group_id`
- theoretical lectures: `course_id` + `section_id` or `major_id`

The lecture item shape matches the existing `/lectures` API response item shape:

```ts
{
  id: number,
  day: string,
  time_box_order: number,
  lecture_type: "PRACTICAL" | "THEORETICAL",
  course_id: number,
  location_id: number,
  instructor_id: number,
  group_id: number | null,
  section_id: number | null,
  major_id: number | null,
  created_at: string,
  updated_at: string,
  course: {
    id: number,
    name: string,
    course_type: string
  },
  location: {
    id: number,
    name: string
  },
  instructor: {
    id: number,
    full_name: string,
    role: string
  },
  group: {
    id: number,
    name: string
  } | null,
  section: {
    id: number,
    name: string
  } | null,
  major: {
    id: number,
    name: string
  } | null
}
```

### Exam phase behavior

When `item_type` is `"practical_exam"` or `"theoretical_exam"`, the response is the same exam schedule used by mini schedule.

Each item is an `ExamItem` plus:

```ts
{
  item_status: "finished" | "today" | "upcoming"
}
```

---

## Frontend Rendering Notes

Use `data.item_type` first to choose the UI variant:

- `lecture`: render lecture card/schedule UI
- `practical_exam`: render practical exam UI
- `theoretical_exam`: render theoretical exam UI

Use per-item `item_status` for visual state:

- lectures: `finished`, `ongoing`, `upcoming`
- exams: `finished`, `today`, `upcoming`

Empty schedules are valid:

```ts
{
  success: true,
  data: {
    item_type: "...",
    items: []
  }
}
```
