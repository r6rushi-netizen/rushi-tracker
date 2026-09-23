// 🔔 Rushi Tracker — Timer Notification Service Worker
const pendingTimers = new Map();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('message', event => {
  const { type, payload } = event.data || {};

  // ✅ Schedule phase change notifications
  if (type === 'SCHEDULE_NOTIFICATIONS') {
    // Clear old timers
    pendingTimers.forEach(id => clearTimeout(id));
    pendingTimers.clear();

    if (!payload || !payload.events) return;

    payload.events.forEach((evt, index) => {
      const delay = evt.triggerAt - Date.now();
      if (delay > 0 && delay < 7200000) { // Max 2 hours
        const timerId = setTimeout(async () => {
          try {
            await self.registration.showNotification(evt.title, {
              body: evt.body,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'rushi-phase-' + index,
              renotify: true,
              vibrate: [300, 100, 300, 100, 300],
              requireInteraction: false,
              silent: false,
            });
          } catch (e) {}
        }, delay);
        pendingTimers.set(index, timerId);
      }
    });
  }

  // ✅ Cancel all scheduled notifications
  if (type === 'CANCEL_NOTIFICATIONS') {
    pendingTimers.forEach(id => clearTimeout(id));
    pendingTimers.clear();
  }

  // ✅ Show instant notification (for testing)
  if (type === 'SHOW_NOW') {
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      tag: 'rushi-now',
      vibrate: [200, 100, 200],
    });
  }
});

// Notification click → open app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
