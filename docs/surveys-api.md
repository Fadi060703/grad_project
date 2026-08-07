# Surveys Backend API

All routes are mounted under `/api`. Example: `GET /surveys` means `GET /api/surveys`.

## Added backend pieces

- Prisma enum: `SurveyStatus = DRAFT | PUBLISHED | COMPLETED`
- Prisma models: `Survey`, `SurveyAnswer`
- Migration: `src/prisma/migrations/20260807120000_add_surveys/migration.sql`
- Controller: `src/controllers/surveyController.ts`
- Validators: `src/validators/surveys.ts`
- Gemini service: `src/services/aiSurveyInsightsService.ts`
- Routes: `src/router/survey.routes.ts`
- Permissions:
  - Admin: `surveys:read`, `surveys:add`, `surveys:update`, `surveys:delete`
  - Student: `student-surveys:read`, `student-surveys:add`

## Core rules

- Admin creates surveys; students answer them.
- `year_id = null` means all students.
- `year_id = number` means students whose `student.year_id` matches.
- Survey is created as `DRAFT` by default.
- A survey can be updated only while `DRAFT`.
- Students can submit only while survey is `PUBLISHED`.
- Students can submit only once per survey.
- Every question must be answered.
- Questions are single-choice.
- Completing a survey changes status to `COMPLETED` and fills `summary`.
- AI insights can be generated only after completion and overwrite old `ai_insights`.
- Deleting a survey is always allowed and cascades its answers.

## Data shapes

### Admin question input

The frontend does **not** send IDs. Backend generates question/option IDs.

```json
{
  "question": "ما مدى رضاك عن المحاضرات؟",
  "options": [
    { "text": "راضٍ جداً" },
    { "text": "راضٍ" },
    { "text": "غير راضٍ" }
  ]
}
```

Validation:

- survey title is required.
- description is optional/nullable.
- `questions` must contain at least 1 item.
- each question must have non-empty text.
- each question must have at least 2 options.
- each option must have non-empty text.

### Question response

```json
{
  "id": "q_uuid",
  "question": "ما مدى رضاك عن المحاضرات؟",
  "options": [
    { "id": "opt_uuid", "text": "راضٍ جداً" },
    { "id": "opt_uuid", "text": "راضٍ" }
  ]
}
```

### Student submit body

```json
{
  "answers": [
    {
      "question_id": "q_uuid",
      "selected_option_id": "opt_uuid"
    }
  ]
}
```

### Summary shape

```json
[
  {
    "question_id": "q_uuid",
    "question": "ما مدى رضاك عن المحاضرات؟",
    "total_answers": 20,
    "options": [
      {
        "option_id": "opt_uuid",
        "text": "راضٍ جداً",
        "count": 12,
        "percentage": 60
      },
      {
        "option_id": "opt_uuid",
        "text": "راضٍ",
        "count": 8,
        "percentage": 40
      }
    ]
  }
]
```

Percentages are rounded to 2 decimal places.

## Admin endpoints

### `GET /surveys`

Admin list endpoint using `createListHandler`.

**Auth:** required  
**Permission:** `surveys:read`

Supports existing list params:

- `page`
- `pagesize`
- `search`
- `filters`
- `sort`
- `joinOperator`

Allowed filter/sort fields:

- `id`
- `title`
- `description`
- `status`
- `year_id`
- `created_at`
- `updated_at`

Searchable fields:

- `title`
- `description`

Response:

```json
{
  "data": [
    {
      "id": 1,
      "year_id": null,
      "year": null,
      "title": "استبيان رضا الطلاب",
      "description": "وصف اختياري",
      "questions": [
        {
          "id": "q_uuid",
          "question": "السؤال؟",
          "options": [
            { "id": "opt_uuid", "text": "خيار 1" },
            { "id": "opt_uuid", "text": "خيار 2" }
          ]
        }
      ],
      "status": "DRAFT",
      "summary": null,
      "ai_insights": null,
      "created_at": "2026-08-07T12:00:00.000Z",
      "updated_at": "2026-08-07T12:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  }
}
```

### `POST /surveys`

Create a draft survey.

**Auth:** required  
**Permission:** `surveys:add`

Body:

```json
{
  "year_id": null,
  "title": "استبيان رضا الطلاب",
  "description": "وصف اختياري",
  "questions": [
    {
      "question": "السؤال؟",
      "options": [
        { "text": "خيار 1" },
        { "text": "خيار 2" }
      ]
    }
  ]
}
```

Success response:

```json
{
  "success": true,
  "message": "Survey created successfully",
  "data": "Survey object"
}
```

### `PUT /surveys/:id`

Update a draft survey.

**Auth:** required  
**Permission:** `surveys:update`

Allowed fields:

- `year_id`
- `title`
- `description`
- `questions`

Not allowed through this endpoint:

- `status`
- `summary`
- `ai_insights`

Only `DRAFT` surveys can be updated. If `questions` are updated, backend generates new IDs for the new question set.

Success response:

```json
{
  "success": true,
  "message": "Survey updated successfully",
  "data": "Survey object"
}
```

### `DELETE /surveys/:id`

Delete a survey in any status.

**Auth:** required  
**Permission:** `surveys:delete`

Success response:

```json
{
  "success": true,
  "message": "Survey deleted successfully",
  "data": "Deleted survey object"
}
```

### `POST /surveys/:id/publish`

Publish a draft survey.

**Auth:** required  
**Permission:** `surveys:update`

Body: none.

Behavior:

- Only `DRAFT` surveys can be published.
- Status becomes `PUBLISHED`.
- Sends Arabic notifications to related students.
- Notification title: `استبيان جديد متاح`
- Notification body: `يرجى إكمال الاستبيان: {survey.title}`
- Notification route: `/website/surveys/{id}`

Success response:

```json
{
  "success": true,
  "message": "Survey published successfully",
  "data": "Survey object",
  "notification": {
    "studentsRequested": 10,
    "studentsFound": 10,
    "notificationsCreated": 10,
    "subscriptionsFound": 5,
    "pushSent": 5,
    "pushFailed": 0,
    "subscriptionsDeleted": 0,
    "skippedStudentIds": []
  }
}
```

`notification` can be `null` if notification sending fails internally; publishing still succeeds.

### `POST /surveys/:id/complete`

Complete a published survey and compute summary.

**Auth:** required  
**Permission:** `surveys:update`

Body: none.

Only `PUBLISHED` surveys can be completed. It does not require all related students to answer.

Success response:

```json
{
  "success": true,
  "message": "Survey completed successfully",
  "data": "Survey object with status COMPLETED and summary filled"
}
```

### `POST /surveys/:id/generate-ai-insights`

Generate Arabic Gemini insights from the completed survey summary.

**Auth:** required  
**Permission:** `surveys:update`

Body: none.

Rules:

- Survey must be `COMPLETED`.
- Survey must have `summary`.
- Existing `ai_insights` is overwritten.
- Requires `GEMINI_API_KEY` in backend environment.

Success response:

```json
{
  "success": true,
  "message": "Survey AI insights generated successfully",
  "data": {
    "id": 1,
    "status": "COMPLETED",
    "summary": [],
    "ai_insights": "نص التحليل العربي من Gemini"
  }
}
```

### `GET /surveys/:id/summary`

Get summary and AI insights.

**Auth:** required  
**Permission:** `surveys:read`

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "COMPLETED",
    "summary": [],
    "ai_insights": "نص التحليل العربي أو null"
  }
}
```

## Student endpoints

### `GET /my-student-surveys`

Student list endpoint using `createListHandler`.

**Auth:** required  
**Permission:** `student-surveys:read`

Returns only metadata for published surveys related to the student and not answered yet.

Supports existing list params:

- `page`
- `pagesize`
- `search`
- `filters`
- `sort`
- `joinOperator`

Allowed filter/sort fields:

- `id`
- `title`
- `description`
- `year_id`
- `created_at`
- `updated_at`

Response:

```json
{
  "data": [
    {
      "id": 1,
      "year_id": null,
      "year": null,
      "title": "استبيان رضا الطلاب",
      "description": "وصف اختياري",
      "status": "PUBLISHED",
      "created_at": "2026-08-07T12:00:00.000Z",
      "updated_at": "2026-08-07T12:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  }
}
```

### `GET /surveys/:id`

Student detail endpoint used to load questions before answering.

**Auth:** required  
**Permission:** `student-surveys:read`

Rules:

- authenticated user must be a student.
- survey must be `PUBLISHED`.
- survey must be related to the student's year, or `year_id = null`.

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "year_id": null,
    "year": null,
    "title": "استبيان رضا الطلاب",
    "description": "وصف اختياري",
    "questions": [
      {
        "id": "q_uuid",
        "question": "السؤال؟",
        "options": [
          { "id": "opt_uuid", "text": "خيار 1" },
          { "id": "opt_uuid", "text": "خيار 2" }
        ]
      }
    ],
    "status": "PUBLISHED",
    "created_at": "2026-08-07T12:00:00.000Z",
    "updated_at": "2026-08-07T12:00:00.000Z",
    "has_answered": false
  }
}
```

### `POST /surveys/:id/answers`

Submit one student answer entry.

**Auth:** required  
**Permission:** `student-surveys:add`

Body:

```json
{
  "answers": [
    {
      "question_id": "q_uuid",
      "selected_option_id": "opt_uuid"
    }
  ]
}
```

Success response:

```json
{
  "success": true,
  "message": "Survey answer submitted successfully",
  "data": {
    "id": 1,
    "survey_id": 1,
    "student_id": 5,
    "answers": [
      {
        "question_id": "q_uuid",
        "selected_option_id": "opt_uuid"
      }
    ],
    "created_at": "2026-08-07T12:00:00.000Z",
    "updated_at": "2026-08-07T12:00:00.000Z"
  }
}
```

Common errors:

- `400` — survey is not published or is not accepting answers.
- `400` — not all questions were answered.
- `400` — duplicate question answer.
- `400` — selected option does not belong to the question.
- `404` — survey not found or not related to the student.
- `409` — student already answered this survey.
