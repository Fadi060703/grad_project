# Dashboard APIs

All dashboard endpoints are read-only and require authentication.

Response wrapper:

```ts
{
  success: true,
  data: ...
}
```

All response property names use `snake_case`.

## Shared rules

### Dates and time windows

- Date calculations use the backend/server local timezone.
- Academic week means Sunday through Thursday.
- Date filters, when available, override the default time window for date-based stats.
- Current semester lecture data is based on the existing `weekly_lectures` records because old semester weekly lectures are deleted.

### Given lecture rules

Practical weekly lecture is considered given when:

```txt
status = PUBLISHED
lecture_date <= today
```

Theoretical weekly lecture is considered given when:

```txt
status != CANCELLED
lecture_date <= today
```

Theoretical lectures do not have attendance data.

### Attendance rules

Attendance is practical-only.

`expected_count` means attendance opportunities, not unique students.

Example: if a group has 50 students and has 3 given practical lectures:

```txt
expected_count = 150
```

Missing `lecture_attendances` rows count as absent. Normally this should not happen because publishing a practical weekly lecture creates attendance rows for group students.

### Marks rules

Marks dashboard stats use:

```txt
SystemSettings.current_academic_key
```

If `current_academic_key` is missing, endpoints that need marks stats return `400 Bad Request`.

Student-course enrollment for marks coverage means a row exists in `student_courses`; `StudentCourse.status` is not used.

### Course completeness rules

Completeness is based only on given weekly lectures.

Semester baseline:

```txt
12 weeks
```

Practical completeness:

```txt
given practical weekly lectures / 12
```

Theoretical completeness:

```txt
given theoretical weekly lectures / (12 * matching base theoretical lectures per week)
```

Exact completeness is returned only when the required filters exist. Otherwise `course_completeness` is `null`.

---

# Admin dashboard

## Endpoint

```http
GET /dashboard/admin
```

Permission:

```txt
admin-dashboard:read
```

## Filters

Optional filters:

```txt
year_id
section_id
major_id
group_id
course_id
from_date
to_date
type=THEORETICAL | PRACTICAL
```

Notes:

- Do not send both `section_id` and `major_id`.
- Filters apply only to sections where they make sense.
- Staff/user totals are global and are not narrowed by academic filters.

## Response shape

```ts
{
  success: true,
  data: {
    summary_cards: {
      total_active_students: number,
      total_active_staff_by_role: Record<string, number>,
      total_courses: number,
      current_academic_week_lecture_summary: {
        upcoming: number,
        given: number,
        cancelled: number
      },
      current_academic_week_attendance_rate: number,
      exam_publication_summary: {
        published: number,
        not_published: number
      },
      marks_publication_summary: {
        practical_published_courses: number,
        full_published_courses: number,
        unpublished_courses: number
      },
      recent_announcements_count: number,
      current_academic_key: string
    },

    students_breakdown: {
      by_year: [
        {
          year_id: number,
          year_name: string,
          student_count: number
        }
      ]
    },

    course_enrollment_breakdown: {
      top_courses_by_students: [
        {
          course_id: number,
          course_name: string,
          student_count: number
        }
      ]
    },

    weekly_lectures_breakdown: {
      this_academic_week: {
        upcoming: number,
        given: number,
        cancelled: number
      },
      by_type: [
        {
          type: "THEORETICAL" | "PRACTICAL",
          upcoming: number,
          given: number,
          cancelled: number
        }
      ]
    },

    attendance_breakdown: {
      this_academic_week: {
        attendance_rate: number,
        attended_count: number,
        expected_count: number,
        absence_count: number,
        given_lectures_count: number
      },
      current_semester: {
        attendance_rate: number,
        attended_count: number,
        expected_count: number,
        absence_count: number,
        given_lectures_count: number
      },
      lowest_attendance_lectures: [
        {
          weekly_lecture_id: number,
          course_id: number,
          course_name: string,
          group_id: number | null,
          group_name: string | null,
          lecture_date: string,
          instructor_id: number | null,
          instructor_name: string | null,
          attendance_rate: number,
          attended_count: number,
          expected_count: number
        }
      ]
    },

    exams_breakdown: {
      by_publication_status: {
        published: number,
        not_published: number
      },
      upcoming_exams: [
        {
          exam_id: number,
          course_id: number,
          course_name: string,
          type: "THEORETICAL" | "PRACTICAL",
          nearest_date: string
        }
      ],
      exams_without_settings: [
        {
          exam_id: number,
          course_id: number,
          course_name: string,
          type: "THEORETICAL" | "PRACTICAL",
          status: "NOT_READY" | "READY" | "PUBLISHED"
        }
      ]
    },

    marks_breakdown: {
      publication_status: {
        practical_published_courses: number,
        full_published_courses: number,
        unpublished_courses: number
      },
      courses_missing_marks: [
        {
          course_id: number,
          course_name: string,
          total_course_students: number,
          students_with_marks: number,
          missing_marks: number,
          coverage_percent: number
        }
      ]
    },

    announcements_breakdown: {
      recent_count: number,
      by_type: [
        {
          type: "REGULAR" | "IMPORTANT" | "EMERGENCY",
          count: number
        }
      ],
      recent_announcements: [
        {
          announcement_id: number,
          title: string,
          type: "REGULAR" | "IMPORTANT" | "EMERGENCY",
          created_at: string,
          creator_id: number | null,
          creator_name: string | null
        }
      ]
    },

    course_completeness: {
      course_id: number,
      course_name: string,
      type: "THEORETICAL" | "PRACTICAL",
      group_id?: number,
      group_name?: string,
      section_id?: number,
      section_name?: string,
      major_id?: number,
      major_name?: string,
      given_lectures_count: number,
      expected_lectures_count: number,
      completion_percent: number
    } | null
  }
}
```

## Admin completeness filters

Practical completeness requires:

```txt
type=PRACTICAL
course_id
group_id
```

Theoretical completeness requires:

```txt
type=THEORETICAL
course_id
section_id OR major_id
```

---

# Doctor dashboard

## Endpoint

```http
GET /dashboard/doctor
```

Permission:

```txt
doctor-dashboard:read
```

## Scope

- Courses where the logged-in doctor is in `Course.doctors`.
- Theoretical weekly lecture stats are only for theoretical lectures instructed by the doctor.
- Practical attendance is for practical lectures in the doctor's assigned courses, even if another teacher instructed the practical lecture.
- Practical weekly lecture status cards are not included for doctors.

## Filters

Optional filters:

```txt
course_id
type=THEORETICAL | PRACTICAL
group_id        // practical stats
section_id      // theoretical stats
major_id        // theoretical stats
```

Do not send both `section_id` and `major_id`.

## Response shape

```ts
{
  success: true,
  data: {
    weekly_lecture_stats: {
      upcoming_theoretical: number,
      given_theoretical: number,
      cancelled_theoretical: number
    },

    attendance_breakdown: {
      this_academic_week: {
        attendance_rate: number,
        attended_count: number,
        expected_count: number,
        absence_count: number,
        given_lectures_count: number
      },
      current_semester: {
        attendance_rate: number,
        attended_count: number,
        expected_count: number,
        absence_count: number,
        given_lectures_count: number
      },
      lowest_attendance_lectures: [
        {
          weekly_lecture_id: number,
          course_id: number,
          course_name: string,
          group_id: number | null,
          group_name: string | null,
          lecture_date: string,
          instructor_id: number | null,
          instructor_name: string | null,
          attendance_rate: number,
          attended_count: number,
          expected_count: number
        }
      ]
    },

    course_completeness: {
      course_id: number,
      course_name: string,
      type: "THEORETICAL" | "PRACTICAL",
      group_id?: number,
      group_name?: string,
      section_id?: number,
      section_name?: string,
      major_id?: number,
      major_name?: string,
      given_lectures_count: number,
      expected_lectures_count: number,
      completion_percent: number
    } | null,

    marks_summary: [
      {
        course_id: number,
        course_name: string,
        average_practical_mark: number | null,
        average_theoretical_mark: number | null,
        average_total_mark: number | null,
        highest_total_mark: number | null,
        lowest_total_mark: number | null,
        is_practical_marks_published: boolean,
        is_full_marks_published: boolean
      }
    ],

    nearest_exams: [
      {
        course_id: number,
        course_name: string,
        exam_id: number,
        type: "THEORETICAL" | "PRACTICAL",
        nearest_date: string
      }
    ],

    announcements_summary: {
      recent_count: number,
      by_type: [
        {
          type: "REGULAR" | "IMPORTANT" | "EMERGENCY",
          count: number
        }
      ]
    }
  }
}
```

## Doctor completeness filters

Practical completeness requires:

```txt
type=PRACTICAL
course_id
group_id
```

Theoretical completeness requires:

```txt
type=THEORETICAL
course_id
section_id OR major_id
```

---

# Teacher dashboard

## Endpoint

```http
GET /dashboard/teacher
```

Permission:

```txt
teacher-dashboard:read
```

## Scope

- Teacher weekly lecture and attendance stats are practical-only.
- Weekly lecture and attendance stats use lectures where `Lecture.instructor_id` is the logged-in teacher.
- Marks and exams summaries use courses where the teacher is in `Course.teachers`.

## Filters

Optional filters:

```txt
course_id
group_id
```

The teacher endpoint does not support `type`; it is always practical-only.

## Response shape

```ts
{
  success: true,
  data: {
    weekly_lecture_stats: {
      upcoming_practical: number,
      given_practical: number,
      cancelled_practical: number
    },

    attendance_breakdown: {
      this_academic_week: {
        attendance_rate: number,
        attended_count: number,
        expected_count: number,
        absence_count: number,
        given_lectures_count: number
      },
      current_semester: {
        attendance_rate: number,
        attended_count: number,
        expected_count: number,
        absence_count: number,
        given_lectures_count: number
      },
      lowest_attendance_lectures: [
        {
          weekly_lecture_id: number,
          course_id: number,
          course_name: string,
          group_id: number | null,
          group_name: string | null,
          lecture_date: string,
          attendance_rate: number,
          attended_count: number,
          expected_count: number
        }
      ]
    },

    course_completeness: {
      course_id: number,
      course_name: string,
      type: "PRACTICAL",
      group_id: number,
      group_name: string,
      given_lectures_count: number,
      expected_lectures_count: 12,
      completion_percent: number
    } | null,

    marks_summary: [
      {
        course_id: number,
        course_name: string,
        average_practical_mark: number | null,
        average_theoretical_mark: number | null,
        average_total_mark: number | null,
        highest_total_mark: number | null,
        lowest_total_mark: number | null,
        is_practical_marks_published: boolean,
        is_full_marks_published: boolean
      }
    ],

    nearest_exams: [
      {
        course_id: number,
        course_name: string,
        exam_id: number,
        type: "PRACTICAL",
        nearest_date: string
      }
    ],

    announcements_summary: {
      recent_count: number,
      by_type: [
        {
          type: "REGULAR" | "IMPORTANT" | "EMERGENCY",
          count: number
        }
      ]
    }
  }
}
```

## Teacher completeness filters

Teacher completeness appears only when both filters are provided:

```txt
course_id
group_id
```

Otherwise:

```ts
course_completeness: null
```

---

# Content DE dashboard

## Endpoint

```http
GET /dashboard/content-de
```

Permission:

```txt
content-dashboard:read
```

## Response shape

```ts
{
  success: true,
  data: {
    content_summary: {
      total_faqs: number,
      total_blogs: number,
      total_exam_guidelines: number
    },

    announcements_summary: {
      recent_count: number,
      by_type: [
        {
          type: "REGULAR" | "IMPORTANT" | "EMERGENCY",
          count: number
        }
      ]
    },

    recent_announcements: [
      {
        announcement_id: number,
        title: string,
        type: "REGULAR" | "IMPORTANT" | "EMERGENCY",
        created_at: string,
        creator_id: number | null,
        creator_name: string | null
      }
    ]
  }
}
```

Defaults:

- `announcements_summary.recent_count`: last 30 days.
- `recent_announcements`: latest 5 announcements.

---

# Exams DE dashboard

## Endpoint

```http
GET /dashboard/exams-de
```

Permission:

```txt
exams-dashboard:read
```

`MARKS_DE` is deprecated. Marks dashboard data belongs to `EXAMS_DE`.

## Response shape

```ts
{
  success: true,
  data: {
    exam_publication_summary: {
      published: number,
      not_published: number
    },

    exams_without_settings: [
      {
        exam_id: number,
        course_id: number,
        course_name: string,
        type: "THEORETICAL" | "PRACTICAL",
        status: "NOT_READY" | "READY" | "PUBLISHED"
      }
    ],

    upcoming_exams: [
      {
        exam_id: number,
        course_id: number,
        course_name: string,
        type: "THEORETICAL" | "PRACTICAL",
        nearest_date: string
      }
    ],

    marks_coverage: [
      {
        course_id: number,
        course_name: string,
        total_course_students: number,
        students_with_marks: number,
        missing_marks: number,
        coverage_percent: number
      }
    ],

    marks_publication_summary: {
      practical_published_courses: number,
      full_published_courses: number,
      unpublished_courses: number
    }
  }
}
```

Notes:

- `exam_publication_summary.not_published` means `Exam.status != PUBLISHED`.
- `upcoming_exams.nearest_date` is the nearest upcoming `ExamSettings.date` per exam.
- `marks_coverage` includes only courses that have at least one `StudentCourse` row.
- `marks_coverage` returns the 10 courses with worst coverage first.

---

# Lectures Schedule DE dashboard

## Endpoint

```http
GET /dashboard/lectures-schedule-de
```

Permission:

```txt
lectures-schedule-dashboard:read
```

## Filters

Optional filters:

```txt
section_id
major_id
```

Do not send both `section_id` and `major_id`.

## Response shape

```ts
{
  success: true,
  data: {
    timetable_summary: {
      total_lectures: number,
      theoretical_lectures: number,
      practical_lectures: number
    },

    lectures_by_day: [
      {
        day: "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY",
        count: number
      }
    ],

    invalid_scope_lectures: [
      {
        lecture_id: number,
        course_id: number,
        course_name: string,
        lecture_type: "THEORETICAL" | "PRACTICAL",
        day: string,
        time_box_order: number,
        reason: string
      }
    ],

    location_usage: [
      {
        location_id: number,
        location_name: string,
        lecture_count: number
      }
    ]
  }
}
```

Definitions:

- Practical lecture invalid scope: missing `group_id`.
- Theoretical lecture invalid scope: both `section_id` and `major_id` are missing.
- Any lecture invalid scope: both `section_id` and `major_id` are set.
- `invalid_scope_lectures`: first 5 invalid lectures.
- `location_usage`: top 5 locations by lecture count.
