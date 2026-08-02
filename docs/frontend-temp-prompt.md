# Frontend handoff prompt: Web Push notifications

I'm adding push notification support to my Next.js App Router frontend. The backend is already implemented using raw Web Push with VAPID keys via the `web-push` npm package, not Firebase.

I already have a bell icon/popover component built. Do not rebuild the UI from scratch; wire the existing UI to the backend APIs below.

## Backend status

The backend now has:

- Prisma tables:
  - `push_subscriptions`
  - `notifications`
- Student-only push subscription storage.
- Per-student notification rows for the bell icon.
- Web Push sending helper on the backend.
- Expired/invalid push subscriptions are deleted when push services return `404` or `410`.
- WebSocket startup is currently disabled in the backend while push notifications are being added.
- A tiny backend test page exists at:
  - `GET /test-push.html`
- A tiny test service worker exists at:
  - `GET /sw.js`

The backend base URL in local development is usually:

```txt
http://localhost:8001
```

All API routes below are mounted under `/api`.

## Required environment variable

The frontend needs the VAPID public key:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=PASTE_PUBLIC_KEY_HERE
```

The VAPID key pair is generated from the backend project with:

```bash
npx web-push generate-vapid-keys
```

The public key is safe to expose to the browser. The private key must remain only in the backend `.env`.

Backend env vars are:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

## Authentication requirement

The backend currently uses JWT Bearer auth:

```http
Authorization: Bearer <student_jwt>
```

Only logged-in users with role `STUDENT` can use notification APIs.

Important service worker caveat: a service worker cannot read `localStorage`. If the app stores JWT in `localStorage` or React state, `notificationclick` cannot automatically call authenticated backend APIs unless you explicitly make the token available to the service worker, for example with `postMessage` and IndexedDB. If you do not want to store JWT in the service worker, then on notification click open the route and let the normal Next.js app mark the notification as read after it loads.

## Browser PushSubscription shape

Use the real browser shape from `PushSubscription.toJSON()`:

```ts
{
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}
```

The backend accepts this shape at `POST /api/push-subscriptions` and stores only:

- `endpoint`
- `keys.p256dh`
- `keys.auth`

## Backend APIs

### 1. Save or update current browser subscription

```http
POST /api/push-subscriptions
Authorization: Bearer <student_jwt>
Content-Type: application/json
```

Body:

```json
{
  "endpoint": "https://...",
  "expirationTime": null,
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

Response:

```json
{
  "success": true,
  "message": "Push subscription saved successfully",
  "data": {
    "id": 1,
    "student_id": 1,
    "endpoint": "https://...",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### 2. Delete current browser subscription

```http
DELETE /api/push-subscriptions
Authorization: Bearer <student_jwt>
Content-Type: application/json
```

To delete one browser/device subscription:

```json
{
  "endpoint": "https://..."
}
```

To delete all subscriptions for the logged-in student, send an empty body:

```json
{}
```

Response:

```json
{
  "success": true,
  "message": "Push subscription deleted successfully",
  "data": {
    "deleted_count": 1
  }
}
```

### 3. List notifications for bell/popover

```http
GET /api/notifications?page=1&pagesize=10
Authorization: Bearer <student_jwt>
```

Uses the backend's existing paginated list pattern.

Default order is newest first by `created_at desc`.

Response:

```json
{
  "data": [
    {
      "id": 12,
      "student_id": 1,
      "title": "Test notification",
      "body": "Backend push test",
      "route": "/test-push.html",
      "icon": null,
      "is_read": false,
      "created_at": "..."
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

Supported query params:

```txt
page=1
pagesize=10
search=some text
sort=[{"id":"created_at","desc":true}]
filters=[...]
joinOperator=and | or
```

Allowed sort fields:

```txt
id, title, body, route, icon, is_read, created_at
```

Search fields:

```txt
title, body
```

### 4. Get unread count

```http
GET /api/notifications/unread-count
Authorization: Bearer <student_jwt>
```

Response:

```json
{
  "success": true,
  "data": {
    "count": 3
  }
}
```

### 5. Mark one notification as read

```http
PATCH /api/notifications/:id/read
Authorization: Bearer <student_jwt>
```

Only marks the notification if it belongs to the logged-in student.

Response:

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": 12,
    "student_id": 1,
    "title": "Test notification",
    "body": "Backend push test",
    "route": "/test-push.html",
    "icon": null,
    "is_read": true,
    "created_at": "..."
  }
}
```

## Push payload shape from backend

When the backend sends an actual Web Push message, the service worker receives JSON like:

```ts
{
  title: string;
  body: string;
  icon?: string;
  data: {
    route?: string;
    notificationId: number;
  };
}
```

The `notificationId` is the database `notifications.id` for the logged-in student. Use it to mark the notification as read.

## Tasks

### 1. Create/update service worker

Create or update:

```txt
public/sw.js
```

It should:

- Listen to `push`.
- Parse `event.data.json()`.
- Read:
  - `title`
  - `body`
  - `icon`
  - `data.route`
  - `data.notificationId`
- Show the browser notification with:

```js
self.registration.showNotification(title, {
  body,
  icon,
  data: { route, notificationId },
});
```

On `notificationclick`:

- Close the notification.
- Open/focus `data.route` if provided.
- Mark the notification as read.

Because backend auth uses Bearer JWT, choose one of these approaches:

A. If you can safely make the current JWT available to the service worker, call:

```http
PATCH /api/notifications/:notificationId/read
Authorization: Bearer <student_jwt>
```

B. Otherwise, open the route with the notification ID, for example:

```txt
/target-route?notificationId=12
```

Then let the Next.js app call the authenticated `PATCH` after it loads.

Do not make unauthenticated PATCH calls; they will fail with `401`.

### 2. Create a hook for permission/subscription

Create a hook like:

```ts
useNotificationPermission()
```

It should:

- Register the service worker.
- Check if notifications are supported:
  - `"serviceWorker" in navigator`
  - `"PushManager" in window`
  - `"Notification" in window`
- Request permission only from a user button click, not automatically on page load.
- Use:

```ts
registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
});
```

- If already subscribed, reuse `registration.pushManager.getSubscription()` and still POST it to backend to ensure the DB is current.
- Send `subscription.toJSON()` to:

```http
POST /api/push-subscriptions
```

with the student's Bearer JWT.

- Include an unsubscribe/disable function that:
  - gets the current subscription
  - calls `DELETE /api/push-subscriptions` with `{ endpoint }`
  - calls `subscription.unsubscribe()`

### 3. Wire the existing bell icon/popover

Use the existing bell UI and connect it to:

- `GET /api/notifications?page=1&pagesize=10`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/:id/read`

Behavior:

- Show unread count as a badge.
- Show newest notifications first.
- On clicking a notification item:
  - mark it read with `PATCH`
  - update local UI state so it immediately appears read
  - refresh unread count
  - navigate to `notification.route` if present

### 4. Keep scope small

Do not build backend trigger logic for grades, lecture cancellations, etc. The backend foundation exists; later backend work will call `notifyStudents(...)` from specific events.

## Local backend test page

Until the real frontend exists, the backend provides a tiny manual test page:

```txt
http://localhost:8001/test-push.html
```

It is intentionally unstyled. It asks for:

- student JWT
- VAPID public key

Then it can:

- register `/sw.js`
- subscribe the browser
- send the subscription to `POST /api/push-subscriptions`
- call the dev-only endpoint `POST /api/dev/test-notification`, which sends a test notification to `student_id = 1`

This dev endpoint is disabled in production.

Note: Web Push requires HTTPS or localhost. `http://localhost:8001` works for local testing. A plain LAN IP over HTTP may not work in browsers.
