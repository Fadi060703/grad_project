# Frontend AI Agent Prompt: Marks Audit Logs

The backend now supports audit logging for marks actions. Please update the frontend dashboard to expose this to admins.

## Backend changes available

### New endpoint

- `GET /audit-log`
- Requires authenticated admin access.
- Protected by the backend permission `audit-logs:read` and an explicit admin role check.
- Uses the existing backend list API format powered by `createListHandler`.

### Pagination/query params

The endpoint supports the same list params used by other list endpoints:

- `page`
- `pagesize`
- `search`
- `filters`
- `sort`
- `joinOperator`

Example: fetch audit logs for a course by default:

```http
GET /audit-log?page=1&pagesize=10&filters=[{"id":"course_id","value":123,"type":"number","operator":"eq"}]&sort=[{"id":"created_at","desc":true}]
```

Make sure to URL-encode `filters` and `sort` in the actual client request.

### Response shape

```ts
type AuditLog = {
  id: number;
  action:
    | "MARK_CREATED"
    | "MARK_UPDATED"
    | "MARK_DELETED"
    | "MARK_PRACTICAL_PUBLISHED"
    | "MARK_FULL_PUBLISHED";
  actor_id: number | null;
  actor_role: string | null;
  actor_name: string | null;
  mark_id: number | null;
  course_id: number | null;
  course_name: string | null;
  student_id: number | null;
  student_full_name: string | null;
  academic_key: string | null;
  before_data: unknown | null;
  after_data: unknown | null;
  metadata: unknown | null;
  created_at: string;
};

type AuditLogListResponse = {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};
```

### Searchable fields

The backend search box searches:

- `actor_name`
- `course_name`
- `student_full_name`
- `academic_key`

### Useful filter/sort fields

Useful filters:

- `course_id`
- `student_id`
- `mark_id`
- `actor_id`
- `actor_role`
- `action`
- `academic_key`
- `created_at`

Useful sort fields:

- `created_at`
- `action`
- `actor_name`
- `course_name`
- `student_full_name`

## Frontend tasks

1. Create a new admin-only dashboard page at:

   ```txt
   /[dashboard]/marks-audit-logs
   ```

2. The page should call:

   ```txt
   GET /audit-log
   ```

3. Build a simple table/list showing at least:

   - Date/time (`created_at`)
   - Action (`action`)
   - Actor (`actor_name`, fallback to `actor_id`)
   - Course (`course_name`, fallback to `course_id`)
   - Student (`student_full_name`, fallback to `student_id`) when available
   - Academic key (`academic_key`)

4. Add filters/search UI matching the backend fields above. At minimum include:

   - global search input
   - action filter
   - course filter if `course_id` is present in URL/query
   - sort newest-first by default (`created_at desc`)

5. In the marks page header at:

   ```txt
   /[dashboard]/marks/[course_id]
   ```

   Add a button visible to admins, for example: **Audit Logs**.

6. Clicking the button should navigate to:

   ```txt
   /[dashboard]/marks-audit-logs?course_id=<course_id>
   ```

7. On `/[dashboard]/marks-audit-logs`, if `course_id` exists in the URL query, apply this backend filter by default:

   ```json
   [{ "id": "course_id", "value": 123, "type": "number", "operator": "eq" }]
   ```

8. Keep the URL query in sync with filters where possible, so admins can share/bookmark filtered audit log views.

9. If the current user is not an admin, hide the marks-page audit button and do not show the audit logs page in navigation.

## Notes

- Create/update/delete mark actions are logged once per affected mark.
- Practical/full publish actions are logged once per course publish action.
- Audit log rows keep scalar snapshots like `student_full_name`, `course_name`, and `actor_name`, so the page can search and display names even if related records change later.
