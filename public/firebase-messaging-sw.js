// Service Worker para Firebase Cloud Messaging
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// Configuração do Firebase (mesma do cliente)
const firebaseConfig = {
  apiKey: "AIzaSyB0WixfniQ_RCCbiY7kl_mjznkMkTlL0iw",
  authDomain: "notif-d9c38.firebaseapp.com",
  projectId: "notif-d9c38",
  storageBucket: "notif-d9c38.firebasestorage.app",
  messagingSenderId: "221529103504",
  appId: "1:221529103504:web:dd5afedf539b6f0caf8c15",
  measurementId: "G-E3LLV8CZQ4"
};

// Inicializar Firebase no Service Worker
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Listener para mensagens em segundo plano
onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-sw.js] Received background message:', payload);

  const { notification, data } = payload;
  
  const notificationTitle = notification?.title || 'Nova Notificação';
  const notificationOptions = {
    body: notification?.body || '',
    icon: notification?.icon || '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag: data?.tag || 'firebase-notification',
    data: {
      ...data,
      url: data?.url || '/',
      timestamp: new Date().toISOString()
    },
    actions: [
      {
        action: 'view',
        title: 'Ver Detalhes',
        icon: '/pwa-64x64.png'
      },
      {
        action: 'dismiss',
        title: 'Dispensar'
      }
    ],
    requireInteraction: true,
    silent: false
  };

  // Reproduzir som se especificado
  if (data?.sound) {
    notificationOptions.silent = false;
  }

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Listener para cliques nas notificações
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-sw.js] Notification click received.');

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Abrir URL específica ou homepage
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Se já há uma aba aberta, focar nela
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Se não há abas abertas, abrir uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Listener para quando a notificação é fechada
self.addEventListener('notificationclose', function(event) {
  console.log('[firebase-sw.js] Notification closed:', event.notification.tag);
  
  // Aqui você pode registrar analytics ou outras ações
  const data = event.notification.data;
  if (data?.trackingId) {
    // Enviar evento de fechamento para analytics
    console.log('Tracking notification close:', data.trackingId);
  }
});