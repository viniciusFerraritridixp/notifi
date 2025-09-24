// Configuração do Firebase
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Configuração do Firebase - substitua pelos seus dados do projeto
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firebase Cloud Messaging
const messaging = getMessaging(app);

class FirebaseNotificationService {
  constructor() {
    this.messaging = messaging;
    this.registration = null;
  }

  // Solicitar permissão e obter token FCM
  async requestPermissionAndGetToken() {
    try {
      console.log('🔄 [Firebase] Solicitando permissão para notificações...');
      
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('✅ [Firebase] Permissão concedida');
        
        // Obter service worker registration
        if ('serviceWorker' in navigator) {
          this.registration = await navigator.serviceWorker.ready;
        }

        // Obter token FCM
        const currentToken = await getToken(this.messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: this.registration
        });

        if (currentToken) {
          console.log('✅ [Firebase] Token FCM obtido:', currentToken);
          return currentToken;
        } else {
          console.warn('⚠️ [Firebase] Não foi possível obter o token FCM');
          return null;
        }
      } else {
        console.warn('⚠️ [Firebase] Permissão para notificações negada');
        return null;
      }
    } catch (error) {
      console.error('❌ [Firebase] Erro ao obter token FCM:', error);
      return null;
    }
  }

  // Configurar listener para mensagens em primeiro plano
  setupForegroundMessageListener(callback) {
    onMessage(this.messaging, (payload) => {
      console.log('📨 [Firebase] Mensagem recebida em primeiro plano:', payload);
      
      if (callback && typeof callback === 'function') {
        callback(payload);
      }
      
      // Mostrar notificação personalizada se o app estiver em primeiro plano
      this.showNotification(payload);
    });
  }

  // Mostrar notificação customizada
  showNotification(payload) {
    const { notification, data } = payload;
    
    if (this.registration && this.registration.showNotification) {
      const notificationTitle = notification?.title || 'Nova Notificação';
      const notificationOptions = {
        body: notification?.body || '',
        icon: notification?.icon || '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        tag: data?.tag || 'default',
        data: data || {},
        actions: [
          {
            action: 'view',
            title: 'Ver Detalhes'
          },
          {
            action: 'dismiss',
            title: 'Dispensar'
          }
        ],
        requireInteraction: true
      };

      this.registration.showNotification(notificationTitle, notificationOptions);
    }
  }

  // Verificar se o Firebase está suportado
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }
}

export { FirebaseNotificationService, messaging };
export default new FirebaseNotificationService();