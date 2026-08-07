# Prompt for Frontend AI Agent: Implement Surveys

You are working on the frontend for this graduation project. Implement the new Surveys feature using the backend APIs documented in `docs/surveys-api.md`.

Important: implement the admin CRUD UI the same way other admin tables and dialogs are implemented in the frontend project. Reuse the existing table/list components, filters, sorting, pagination, confirmation dialogs, create/update dialogs, form styles, API client helpers, permission checks, and toast/error handling patterns already used by other modules.

## Backend base

All backend routes are under `/api`.

Read the full API details from:

- `docs/surveys-api.md`

## Main requirements

### 1. Admin surveys management

Create an admin Surveys page similar to other CRUD pages.

Admin permissions used by backend:

- `surveys:read`
- `surveys:add`
- `surveys:update`
- `surveys:delete`

Admin endpoints:

- `GET /api/surveys`
- `POST /api/surveys`
- `PUT /api/surveys/:id`
- `DELETE /api/surveys/:id`
- `POST /api/surveys/:id/publish`
- `POST /api/surveys/:id/complete`
- `POST /api/surveys/:id/generate-ai-insights`
- `GET /api/surveys/:id/summary`

Admin table should show at least:

- ID
- title
- description
- target year (`year.name`, or "كل السنوات" / all years when `year_id = null`)
- status badge: `DRAFT`, `PUBLISHED`, `COMPLETED`
- created date
- updated date
- actions

Use `GET /api/surveys` with the same `createListHandler` query format used by other backend list pages:

- `page`
- `pagesize`
- `search`
- `filters`
- `sort`
- `joinOperator`

Available filters/sorts:

- `id`
- `title`
- `description`
- `status`
- `year_id`
- `created_at`
- `updated_at`

Search fields:

- `title`
- `description`

### 2. Admin create/update dialog

Build the create/update dialog like existing project dialogs.

Create body:

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

Rules:

- `title` required.
- `description` optional.
- `year_id` nullable; null means all students.
- at least 1 question.
- each question requires text.
- each question has at least 2 options.
- each option requires text.
- all questions are single-choice.
- do not send question or option IDs in create/update; backend generates them.
- update works only while status is `DRAFT`.

UI behavior:

- allow admin to dynamically add/remove questions.
- allow admin to dynamically add/remove options per question.
- disable or hide edit action for non-`DRAFT` surveys.
- if editing a draft survey, use the question/option text from the backend response but submit only `{ question, options: [{ text }] }`.

### 3. Admin actions

Add action buttons/menus consistent with other tables:

- edit: only for `DRAFT`.
- delete: allowed for all statuses; use confirmation dialog.
- publish: only for `DRAFT`; use confirmation dialog.
- complete: only for `PUBLISHED`; use confirmation dialog.
- view summary: useful for `COMPLETED`, but can call endpoint for any status.
- generate AI insights: only for `COMPLETED`; use loading state because Gemini can take time.

Publish endpoint:

```txt
POST /api/surveys/:id/publish
```

This sends Arabic notifications to related students using route `/website/surveys/{id}`.

Complete endpoint:

```txt
POST /api/surveys/:id/complete
```

This fills `summary` and changes status to `COMPLETED`.

Generate AI endpoint:

```txt
POST /api/surveys/:id/generate-ai-insights
```

This overwrites `ai_insights` with Arabic Gemini output.

Summary endpoint:

```txt
GET /api/surveys/:id/summary
```

Response data shape:

```json
{
  "id": 1,
  "status": "COMPLETED",
  "summary": [
    {
      "question_id": "q_uuid",
      "question": "السؤال؟",
      "total_answers": 20,
      "options": [
        {
          "option_id": "opt_uuid",
          "text": "خيار 1",
          "count": 12,
          "percentage": 60
        }
      ]
    }
  ],
  "ai_insights": "نص التحليل العربي أو null"
}
```

Render summary clearly:

- question text.
- total answers per question.
- each option count and percentage.
- AI insights text if present.

### 4. Student surveys UI

Implement student-facing survey screens.

Student permissions used by backend:

- `student-surveys:read`
- `student-surveys:add`

Student endpoints:

- `GET /api/my-student-surveys`
- `GET /api/surveys/:id`
- `POST /api/surveys/:id/answers`

`GET /api/my-student-surveys` returns only published surveys related to the student that the student has not answered yet. It returns metadata only, not questions.

List item fields:

- title
- description
- target year if present
- created date
- action to open/take survey

When the student opens a survey, call:

```txt
GET /api/surveys/:id
```

This returns questions/options and `has_answered`.

Answer submission body:

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

Student UI rules:

- render each question as radio buttons, not checkboxes.
- require selecting exactly one option per question.
- do not allow submit until all questions are answered.
- after submit success, show success toast/message and navigate back or remove survey from list.
- handle `409` as already answered.
- handle `400` as validation/not accepting answers.

### 5. Suggested routes/pages

Adapt to the frontend's existing routing conventions, but suggested routes:

Admin:

- `/dashboard/surveys` or the equivalent admin content/settings area.

Student website:

- `/website/surveys` for list.
- `/website/surveys/:id` for answering.

The backend notification route is already `/website/surveys/{id}`, so the frontend should support that student detail route.

### 6. Types to add in frontend

Suggested TypeScript types:

```ts
type SurveyStatus = "DRAFT" | "PUBLISHED" | "COMPLETED";

type SurveyOption = {
  id: string;
  text: string;
};

type SurveyQuestion = {
  id: string;
  question: string;
  options: SurveyOption[];
};

type Survey = {
  id: number;
  year_id: number | null;
  year?: { id: number; name: string } | null;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  status: SurveyStatus;
  summary?: SurveyQuestionSummary[] | null;
  ai_insights?: string | null;
  created_at: string;
  updated_at: string;
};

type SurveyMetadata = Omit<Survey, "questions" | "summary" | "ai_insights">;

type SurveyQuestionSummary = {
  question_id: string;
  question: string;
  total_answers: number;
  options: {
    option_id: string;
    text: string;
    count: number;
    percentage: number;
  }[];
};
```

### 7. Implementation style

Do not invent a new design system. Follow existing frontend project patterns:

- CRUD table patterns.
- create/edit dialog patterns.
- confirmation dialogs.
- status badges.
- API client abstraction.
- query/list hooks if the project uses them.
- form validation approach already used in the app.
- Arabic labels/messages where the app uses Arabic.

Before finishing, test:

- admin creates draft survey.
- admin edits draft survey.
- admin publishes survey.
- student sees the survey in `/website/surveys` or equivalent.
- student opens notification route `/website/surveys/:id`.
- student answers all questions and submits.
- answered survey disappears from `GET /api/my-student-surveys` list.
- admin completes survey and sees summary.
- admin generates AI insights and sees Arabic insights.
