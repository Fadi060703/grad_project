# AI Study APIs

This document describes the AI study features implemented for course files, exam preparation, and course chat.

All routes are mounted under `/api` unless noted otherwise.

## Requirements

- `GEMINI_API_KEY` must be set in `.env`.
- Course file AI generation currently supports PDF files.
- The Prisma migrations for AI flashcards, summaries, exam preparation dependencies, and course chat sessions/messages must be applied.

---

## 1. Course file AI generation

### Triggered by

```http
POST /api/courses/:course_id/files
PUT /api/courses/:course_id/files/:id
```

These are the existing course file create/update APIs.

### What it does

When a course file is created, the backend:

1. Reads the PDF from the stored file path.
2. Sends the PDF to Gemini.
3. Generates:
   - flashcards
   - a structured summary
4. Saves both in the database.
5. Returns the created course file.

When a course file is updated, AI content is regenerated **only if the `file` value changes**.

If Gemini generation fails, course file creation/update fails and returns an error.

### Request body example

```json
{
  "type": "THEORETICAL",
  "file": "/uploads/courses_files/course_1/example.pdf",
  "size": 123456,
  "title": "Lecture 2",
  "mime_type": "application/pdf"
}
```

### Success response example

```json
{
  "id": 10,
  "course_id": 1,
  "type": "THEORETICAL",
  "file": "/uploads/courses_files/course_1/example.pdf",
  "size": 123456,
  "title": "Lecture 2",
  "mime_type": "application/pdf",
  "created_at": "2026-08-06T00:00:00.000Z",
  "updated_at": "2026-08-06T00:00:00.000Z"
}
```

### Possible errors

```json
{ "error": "Course not found" }
```

```json
{ "error": "AI study material generation supports PDF course files only" }
```

```json
{ "error": "Failed to generate AI study materials for the course file" }
```

---

## 2. Flashcards HTML API

### Course-scoped route

```http
GET /api/courses/:course_id/files/:id/flashcards-html
```

### File-id-only route

```http
GET /api/course-files/:id/flashcards-html
```

### Permission

```txt
course-files:read
```

### What it does

Returns a complete HTML page containing flashcards for one course file.

The backend:

1. Reads the saved flashcards JSON from the database.
2. Randomly selects up to 10 cards on every request.
3. Renders a modern mobile-responsive HTML page.
4. Sends raw HTML to the frontend.

### Response

```http
Content-Type: text/html; charset=utf-8
```

The response body is HTML.

### Behavior

- Cards are interactive.
- Clicking a card flips it.
- Long card content is scrollable.
- The frontend can display the HTML in a tab or download it.

### Possible errors

```json
{ "error": "Flashcards not found" }
```

```json
{ "error": "Stored flashcards data is invalid" }
```

---

## 3. Summary HTML API

### Course-scoped route

```http
GET /api/courses/:course_id/files/:id/summary-html
```

### File-id-only route

```http
GET /api/course-files/:id/summary-html
```

### Permission

```txt
course-files:read
```

### What it does

Returns a complete HTML page containing the structured AI summary for one course file.

The backend:

1. Reads the saved summary JSON from the database.
2. Validates the stored structure.
3. Renders a modern mobile-responsive summary page.
4. Sends raw HTML to the frontend.

### Response

```http
Content-Type: text/html; charset=utf-8
```

The response body is HTML.

### Summary data shape stored internally

```json
{
  "title": "Lecture 5: Recursion and Backtracking",
  "overview": "Short high-level summary.",
  "sections": [
    {
      "heading": "Introduction to Recursion",
      "page_reference": "pp. 1-3",
      "content": [
        { "type": "text", "text": "..." },
        { "type": "list", "items": ["...", "..."] },
        {
          "type": "formula",
          "latex": "T(n) = 2T(n/2) + O(n)",
          "fallback_text": "A recurrence relation for divide-and-conquer algorithms."
        },
        { "type": "code", "language": "python", "code": "..." },
        {
          "type": "table",
          "headers": ["Approach", "Time", "Space"],
          "rows": [["Iterative", "O(n)", "O(1)"]]
        }
      ]
    }
  ],
  "glossary": [
    {
      "term": "Base case",
      "definition": "The stopping condition of a recursive function."
    }
  ]
}
```

### Possible errors

```json
{ "error": "Summary not found" }
```

```json
{ "error": "Stored summary data is invalid" }
```

---

## 4. Exam preparation API

### Route

```http
POST /api/ai/exam-preparation
```

### Permission

```txt
course-files:read
```

### What it does

Generates a practice multiple-choice exam from the summaries of selected course files.

The backend:

1. Receives one or more `course_file_ids`.
2. Uses only files that already have generated summaries.
3. Ensures selected existing files belong to one course.
4. If the requester is a student, verifies the student is enrolled in the course.
5. Sends the selected summaries to Gemini.
6. Gemini returns JSON questions.
7. Backend validates the JSON.
8. Backend renders an interactive mobile-responsive HTML exam.
9. Sends raw HTML to the frontend.

The generated exam is **not saved** in the database.

### Request body

```json
{
  "course_file_ids": [1, 2, 3],
  "question_count": 30
}
```

### Request fields

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `course_file_ids` | `number[]` | yes | One or more course file IDs. |
| `question_count` | `number` | no | Defaults to `30`. Minimum `5`, maximum `60`. |

### Response

```http
Content-Type: text/html; charset=utf-8
```

The response body is HTML.

### HTML behavior

Each question has:

- 4 options: `A`, `B`, `C`, `D`
- exactly one correct option
- an explanation
- optional page/source reference when available

When the student clicks an option, the page:

- marks the selected option as correct or wrong
- shows the correct option if wrong
- shows the explanation
- updates answered/correct counters

### Internal Gemini JSON shape

```json
{
  "title": "Practice Exam: Docker Basics",
  "overview": "This practice exam covers Docker images, containers, and layers.",
  "questions": [
    {
      "question": "What is the purpose of Docker image layers?",
      "options": [
        { "id": "A", "text": "..." },
        { "id": "B", "text": "..." },
        { "id": "C", "text": "..." },
        { "id": "D", "text": "..." }
      ],
      "correct_option_id": "C",
      "explanation": "...",
      "page_reference": "pp. 3-5"
    }
  ]
}
```

### Possible errors

```json
{ "error": "No selected course files were found" }
```

```json
{ "error": "Selected course files must belong to one course" }
```

```json
{ "error": "Student is not enrolled in this course" }
```

```json
{ "error": "None of the selected course files have generated summaries yet" }
```

```json
{ "error": "Failed to generate AI exam preparation" }
```

---

## 5. Course chat API

The course chat feature uses Gemini's Interactions API with `previous_interaction_id`.

The database stores:

- the latest Gemini interaction ID for continuity
- a summaries hash to detect changed course context
- chat messages for UI rendering

The backend does **not** resend full chat history to Gemini. It uses Gemini's stored interaction chain.

---

### 5.1 Send a course chat message

```http
POST /api/course-chat
```

### Permission

```txt
course-files:read
```

### What it does

Sends a student/staff question to Gemini and returns an answer based only on the course summaries.

The backend:

1. Receives `course_id` and `question`.
2. Checks the course exists.
3. If requester is a student, verifies enrollment in the course.
4. Loads all generated summaries for the course.
5. If no summaries exist, returns an error.
6. Computes `summaries_hash`.
7. Finds or creates a chat session for `user_id + course_id`.
8. If the session is new or summaries changed, sends all summaries to Gemini.
9. Otherwise, sends only the new question with `previous_interaction_id`.
10. Saves both the user message and model answer in DB.
11. Returns the answer and session metadata.

### Request body

```json
{
  "course_id": 1,
  "question": "Explain Docker image layers briefly"
}
```

### Success response

```json
{
  "answer": "Docker image layers are reusable filesystem changes that make image builds and downloads more efficient.",
  "session_id": 12,
  "is_new_session": false,
  "context_refreshed": false
}
```

### Response fields

| Field | Type | Notes |
|---|---:|---|
| `answer` | `string` | Gemini answer based only on course summaries. |
| `session_id` | `number` | Backend chat session ID. |
| `is_new_session` | `boolean` | `true` if this was the first chat for this user/course. |
| `context_refreshed` | `boolean` | `true` if summaries changed and Gemini context was reset. |

### Possible errors

```json
{ "error": "Course not found" }
```

```json
{ "error": "Student is not enrolled in this course" }
```

```json
{ "error": "This course does not have lectures yet" }
```

```json
{ "error": "Failed to generate course chat answer" }
```

---

### 5.2 Get previous course chat messages

```http
GET /api/course-chat/:course_id/messages
```

### Permission

```txt
course-files:read
```

### What it does

Returns previous chat messages for the authenticated user and course.

Messages are scoped by:

```txt
user_id + course_id
```

So every student/staff user sees only their own chat history for that course.

Messages are returned oldest-first.

### Success response with messages

```json
{
  "session_id": 12,
  "summaries_hash": "abc123...",
  "messages": [
    {
      "id": 1,
      "sender": "USER",
      "content": "Explain Docker layers",
      "created_at": "2026-08-06T12:00:00.000Z"
    },
    {
      "id": 2,
      "sender": "MODEL",
      "content": "Docker layers are reusable filesystem changes...",
      "created_at": "2026-08-06T12:00:03.000Z"
    }
  ]
}
```

### Success response with no session yet

```json
{
  "session_id": null,
  "messages": []
}
```

### Possible errors

```json
{ "error": "Invalid course_id" }
```

```json
{ "error": "Course not found" }
```

```json
{ "error": "Student is not enrolled in this course" }
```

---

## 6. University chatbot APIs

The university chatbot is a student-only general assistant that answers questions about the university/faculty based on a markdown file stored under `public`.

The markdown file path is configured in `FaculityInfo.uni_chatbot_file` as a relative public path, for example:

```json
{
  "uni_chatbot_file": "/uploads/chatbot/university-info.md"
}
```

If the file is not configured, missing, empty, or the question is outside the file content, the chatbot returns a regular answer telling the student that the topic is outside its knowledge.

The chatbot uses Gemini's Interactions API with `previous_interaction_id`. The database stores:

- one chatbot session per student
- the latest Gemini interaction ID
- a content hash for the markdown file
- all user/model messages for UI rendering

The backend does **not** resend full chat history to Gemini.

---

### 6.1 Update faculty chatbot file path

This uses the existing faculty info create/update API.

```http
PUT /api/faculity-info
```

Request body field:

```json
{
  "uni_chatbot_file": "/uploads/chatbot/university-info.md"
}
```

The same field is also returned by:

```http
GET /api/faculity-info
```

---

### 6.2 Send chatbot message

```http
POST /api/chatbot
```

### Access

Student only.

### What it does

1. Gets the authenticated student from the JWT token.
2. Reads `FaculityInfo.uni_chatbot_file`.
3. Reads the configured markdown file from `public`.
4. Finds or creates one chatbot session for the student.
5. If the session is new or the markdown file changed, sends the markdown content to Gemini.
6. Otherwise, sends only the new message using `previous_interaction_id`.
7. Saves both the student message and model answer in DB.
8. Returns the answer and session metadata.

### Request body

```json
{
  "message": "Where can I find the exam schedule?"
}
```

### Success response

```json
{
  "answer": "You can find the exam schedule from ...",
  "session_id": 4,
  "is_new_session": false,
  "context_refreshed": false
}
```

If the configured markdown file is missing or the answer is not in the file:

```json
{
  "answer": "I could not find this in the university information.",
  "session_id": 4,
  "is_new_session": false,
  "context_refreshed": false
}
```

### Possible errors

```json
{ "error": "Only students can access chatbot" }
```

```json
{ "error": "Failed to generate university chatbot answer" }
```

---

### 6.3 Get previous chatbot messages

```http
GET /api/chatbot/messages
```

### Access

Student only.

### What it does

Returns previous messages between the authenticated student and the university chatbot.

Messages are returned oldest-first.

### Success response with messages

```json
{
  "session_id": 4,
  "content_hash": "abc123...",
  "messages": [
    {
      "id": 1,
      "sender": "USER",
      "content": "Where can I find the exam schedule?",
      "created_at": "2026-08-06T12:00:00.000Z"
    },
    {
      "id": 2,
      "sender": "MODEL",
      "content": "You can find the exam schedule from ...",
      "created_at": "2026-08-06T12:00:02.000Z"
    }
  ]
}
```

### Success response with no session yet

```json
{
  "session_id": null,
  "messages": []
}
```

### Possible errors

```json
{ "error": "Only students can access chatbot" }
```

---

## Test page

A minimal browser test page exists at:

```txt
/test-ai-study-materials.html
```

It can test:

- flashcards HTML download
- summary HTML download
- exam preparation HTML download
- course chat send/load messages

Use it through the backend server origin to avoid CORS issues:

```txt
http://localhost:8001/test-ai-study-materials.html
```
