// Firebase Admin SDK para backend
import admin from 'firebase-admin';

class FirebaseAdminService {
  constructor() {
    this.app = null;
    this.messaging = null;
    this.initialized = false;
  }

  // Inicializar Firebase Admin
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Configuração usando variáveis de ambiente
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`,
      };

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

      this.messaging = admin.messaging();
      this.initialized = true;

      console.log('✅ [Firebase Admin] Inicializado com sucesso');
    } catch (error) {
      console.error('❌ [Firebase Admin] Erro na inicialização:', error);
      throw error;
    }
  }

  // Enviar notificação para um token específico
  async sendNotificationToToken(token, notification, data = {}) {
    try {
      if (!this.initialized) {
        this.initialize();
      }

      const message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: 'high',
          notification: {
            sound: notification.sound || 'default',
            click_action: notification.click_action || 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          headers: {
            // For background delivery on iOS
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              'content-available': 1,
              alert: {
                title: notification.title,
                body: notification.body,
              },
              sound: notification.sound || 'default',
              badge: notification.badge || 1,
            },
          },
        },
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-64x64.png',
            requireInteraction: true,
          },
        },
      };

      const response = await this.messaging.send(message);
      console.log('✅ [Firebase Admin] Notificação enviada:', response);
      return response;
    } catch (error) {
      console.error('❌ [Firebase Admin] Erro ao enviar notificação:', error);
      throw error;
    }
  }

  // Enviar notificações em lote (sendAll)
  async sendBatchNotifications(messages) {
    try {
      if (!this.initialized) {
        this.initialize();
      }

      // messages deve ser um array de objetos compatíveis com sendAll
      const response = await this.messaging.sendAll(messages);

      console.log(`✅ [Firebase Admin] Lote enviado: ${response.successCount}/${messages.length} sucessos`);

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`❌ [Firebase Admin] Falha no índice ${idx}:`, resp.error);
          }
        });
      }

      return response;
    } catch (error) {
      console.error('❌ [Firebase Admin] Erro no envio em lote:', error);
      throw error;
    }
  }

  // Validar token FCM (básico)
  async validateToken(token) {
    if (!token) return false;
    // Implementação simples: valida formato/length
    return typeof token === 'string' && token.length > 10;
  }
}

const firebaseAdminInstance = new FirebaseAdminService();
export default firebaseAdminInstance;