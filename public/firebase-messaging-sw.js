// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
  apiKey: "AIzaSyDYktjeayxZ6Th9WArEXKkr7t1vEeEnHJc",
  authDomain: "nexus-app-c69da.firebaseapp.com",
  projectId: "nexus-app-c69da",
  storageBucket: "nexus-app-c69da.firebasestorage.app",
  messagingSenderId: "975531023010",
  appId: "1:975531023010:web:8b41c68772331ddf17d5fb"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'NEXUS Notification';
  
  // Check if this is an interactive notification (waitlist promotion)
  const requiresResponse = payload.data?.requiresResponse === 'true';
  
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/nexus-icon.svg',
    badge: '/favicon.ico',
    tag: payload.data?.type || 'general',
    data: payload.data,
    actions: requiresResponse ? [
      {
        action: 'accept',
        title: '✅ Accept'
      },
      {
        action: 'decline',
        title: '❌ Decline'
      }
    ] : [
      {
        action: 'view',
        title: 'View'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const action = event.action;
  
  // Handle dismiss action
  if (action === 'dismiss') {
    return;
  }
  
  // Handle accept/decline for waitlist notifications
  if (action === 'accept' || action === 'decline') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        // Send message to app to handle response
        if (clientList.length > 0) {
          clientList[0].postMessage({
            type: 'attendance-response',
            eventId: data.eventId,
            response: action
          });
        }
        return clients.openWindow(`/event/${data.eventId}`);
      })
    );
    return;
  }
  
  // Determine URL based on notification type
  let url = '/';
  
  if (data.type === 'event_new' || data.type === 'event_modified' || data.type === 'event_deleted') {
    url = data.eventId ? `/event/${data.eventId}` : '/calendar';
  } else if (data.type === 'order_new' || data.type === 'order_deadline') {
    url = data.orderId ? `/order/${data.orderId}` : '/orders';
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not already open
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
