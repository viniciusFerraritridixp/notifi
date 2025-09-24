// Processador otimizado de notificações Firebase
const { createClient } = require('@supabase/supabase-js');
const FirebaseAdmin = require('../lib/firebase-admin.js');
const FCMDeviceService = require('./fcmDeviceService.js');
require('dotenv').config();

class OptimizedFirebaseProcessor {
  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.isProcessing = false;
    this.batchSize = 10;
    this.maxRetries = 3;
    this.processingStats = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Processa todas as notificações pendentes com FCM token
   */
  async processPendingNotifications() {
    if (this.isProcessing) {
      console.log('⏳ [Firebase Processor] Já está processando...');
      return this.processingStats;
    }

    this.isProcessing = true;
    this.resetStats();
    
    console.log('🔄 [Firebase Processor] Iniciando processamento otimizado...');

    try {
      // Buscar notificações pendentes usando a nova função
      const notifications = await FCMDeviceService.getPendingNotificationsWithFCM();
      
      if (notifications.length === 0) {
        console.log('✅ [Firebase Processor] Nenhuma notificação pendente com FCM token');
        return this.processingStats;
      }

      console.log(`📊 [Firebase Processor] Processando ${notifications.length} notificações`);

      // Processar em lotes
      for (let i = 0; i < notifications.length; i += this.batchSize) {
        const batch = notifications.slice(i, i + this.batchSize);
        await this.processBatch(batch);
      }

      console.log('✅ [Firebase Processor] Processamento concluído:', this.processingStats);
      return this.processingStats;

    } catch (error) {
      console.error('❌ [Firebase Processor] Erro no processamento:', error.message);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processa um lote de notificações
   */
  async processBatch(notifications) {
    const promises = notifications.map(notification => 
      this.processNotification(notification)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Processa uma notificação individual
   */
  async processNotification(notification) {
    this.processingStats.processed++;

    try {
      console.log(`🔄 Processando notificação ${notification.notification_id} para ${notification.device_token}`);

      // Validar FCM token
      if (!FCMDeviceService.isValidFCMToken(notification.fcm_token)) {
        console.log(`⚠️ FCM token inválido para dispositivo ${notification.device_token}`);
        await FCMDeviceService.markNotificationDelivered(
          notification.notification_id, 
          false, 
          'FCM token inválido'
        );
        this.processingStats.skipped++;
        return;
      }

      // Preparar mensagem Firebase
      const message = this.buildFirebaseMessage(notification);

      // Enviar via Firebase Admin
      const result = await FirebaseAdmin.sendNotificationToToken(
        notification.fcm_token,
        message.title,
        message.body,
        message.data
      );

      if (result.success) {
        console.log(`✅ Notificação ${notification.notification_id} enviada com sucesso`);
        await FCMDeviceService.markNotificationDelivered(notification.notification_id, true);
        this.processingStats.sent++;
      } else {
        console.log(`❌ Falha ao enviar notificação ${notification.notification_id}:`, result.error);
        
        // Verificar se é erro de token inválido
        if (this.isInvalidTokenError(result.error)) {
          console.log(`🧹 Removendo FCM token inválido: ${notification.fcm_token.substring(0, 20)}...`);
          await FCMDeviceService.cleanupInvalidTokens([notification.fcm_token]);
        }

        await FCMDeviceService.markNotificationDelivered(
          notification.notification_id, 
          false, 
          result.error
        );
        this.processingStats.failed++;
      }

    } catch (error) {
      console.error(`❌ Erro ao processar notificação ${notification.notification_id}:`, error.message);
      
      await FCMDeviceService.markNotificationDelivered(
        notification.notification_id, 
        false, 
        error.message
      );
      this.processingStats.failed++;
    }
  }

  /**
   * Constrói a mensagem Firebase baseada na notificação
   */
  buildFirebaseMessage(notification) {
    const baseMessage = {
      title: notification.title,
      body: notification.body,
      data: {
        notification_id: notification.notification_id.toString(),
        device_token: notification.device_token,
        timestamp: new Date().toISOString()
      }
    };

    // Adicionar dados do payload se existir
    if (notification.payload) {
      try {
        const payloadData = typeof notification.payload === 'string' 
          ? JSON.parse(notification.payload) 
          : notification.payload;
        
        Object.keys(payloadData).forEach(key => {
          baseMessage.data[key] = String(payloadData[key]); // FCM data deve ser strings
        });
      } catch (e) {
        console.log('⚠️ Erro ao parse do payload, usando dados básicos');
      }
    }

    // Configurações específicas para plataforma
    const platformConfig = {};

    if (notification.is_ios) {
      platformConfig.apns = {
        payload: {
          aps: {
            alert: {
              title: baseMessage.title,
              body: baseMessage.body
            },
            sound: 'default',
            badge: 1
          }
        }
      };
    }

    if (notification.is_mobile && !notification.is_ios) {
      platformConfig.android = {
        notification: {
          title: baseMessage.title,
          body: baseMessage.body,
          sound: 'default',
          priority: 'high'
        }
      };
    }

    return {
      ...baseMessage,
      ...platformConfig
    };
  }

  /**
   * Verifica se o erro indica token inválido
   */
  isInvalidTokenError(error) {
    const invalidTokenMessages = [
      'invalid-registration-token',
      'registration-token-not-registered',
      'invalid-argument'
    ];

    const errorMessage = error?.toString()?.toLowerCase() || '';
    return invalidTokenMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.processingStats = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Executa limpeza e manutenção
   */
  async runMaintenance() {
    console.log('🧹 [Firebase Processor] Executando manutenção...');

    try {
      // Obter estatísticas
      const stats = await FCMDeviceService.getStats();
      console.log('📊 Estatísticas atuais:', stats);

      // Buscar dispositivos ativos
      const activeDevices = await FCMDeviceService.getActiveDevicesWithFCM();
      console.log(`📱 Dispositivos ativos com FCM: ${activeDevices.length}`);

      // Verificar tokens antigos (mais de 30 dias sem atualizar)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldTokens = activeDevices.filter(device => {
        return new Date(device.fcm_token_updated_at) < thirtyDaysAgo;
      });

      if (oldTokens.length > 0) {
        console.log(`🕒 Encontrados ${oldTokens.length} tokens antigos (>30 dias)`);
        // Aqui você pode implementar lógica para revalidar tokens antigos
      }

      return {
        stats,
        activeDevices: activeDevices.length,
        oldTokens: oldTokens.length
      };

    } catch (error) {
      console.error('❌ Erro na manutenção:', error.message);
      throw error;
    }
  }
}

module.exports = new OptimizedFirebaseProcessor();