self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_err) {
      payload = { title: "Notification", body: event.data.text() };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Notification", {
      body: payload.body || "",
      icon: payload.icon,
      data: payload.data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const route = data.route || "/";
  const notificationId = data.notificationId;

  event.waitUntil(
    (async () => {
      if (notificationId) {
        try {
          await fetch(`/api/notifications/${notificationId}/read`, { method: "PATCH" });
        } catch (_err) {}
      }

      const targetUrl = new URL(route, self.location.origin).href;
      const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of windowClients) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    })(),
  );
});
