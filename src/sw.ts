/// <reference types="vite/client" />
/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Precache build assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Emergency alert handlers for offline sync
self.addEventListener('push', (event) => {
  const pushEvent = event as PushEvent;
  if (!pushEvent.data) return;
  
  const data = pushEvent.data.json();
  const options: NotificationOptions = {
    body: data.body || 'Emergency alert received',
    icon: '/icon-192x192.svg',
    badge: '/icon-192x192.svg',
    tag: 'aware-alert',
    requireInteraction: true,
    data: data
  };
  
  pushEvent.waitUntil(
    self.registration.showNotification(data.title || 'AWARE Emergency Alert', options)
  );
});

// Background sync for queued alerts
self.addEventListener('sync', (event) => {
  const syncEvent = event as any; // Type assertion for sync events
  if (syncEvent.tag === 'alert-sync') {
    syncEvent.waitUntil(syncAlerts());
  }
});

async function syncAlerts() {
  // Implementation for syncing queued alerts when back online
  try {
    await caches.open('aware-alerts');
    // Sync logic here
    console.log('Alert sync completed');
  } catch (error) {
    console.error('Alert sync failed:', error);
  }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  const notificationEvent = event as any; // Type assertion for notification events
  notificationEvent.notification.close();
  notificationEvent.waitUntil(
    self.clients.openWindow('/')
  );
});
