// Service Worker for Push Notifications
const CACHE_NAME = 'premier-league-predictions-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Premier League Predictions', body: event.data.text() };
    }
  }

  const options = {
    title: data.title || 'Premier League Predictions',
    body: data.body || 'You have a new notification',
    icon: '/assets/logos/premier-league.png',
    badge: '/assets/logos/premier-league.png',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [
      {
        action: 'view',
        title: 'View'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Default action or 'view' action
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's already a window open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }

      // Otherwise, open a new window
      if (clients.openWindow) {
        const url = event.notification.data?.url || '/predictions';
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync (if needed for offline functionality)
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'prediction-sync') {
    event.waitUntil(syncPredictions());
  }
});

// Sync predictions when back online
async function syncPredictions() {
  // This would sync any offline predictions when the user comes back online
  console.log('Syncing predictions...');
}
