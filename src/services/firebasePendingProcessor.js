// Processador de notificações pendentes via Firebase
import { createClient } from '@supabase/supabase-js';
import FirebaseAdminService from '../lib/firebase-admin.js';

class PendingNotificationsProcessor {
  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Usar service role key para acesso total
    );
    this.isProcessing = false;
    this.batchSize = 10; // Processar 10 notificações por vez
    this.maxRetries = 3;
  }

  // Processar notificações pendentes
  async processPendingNotifications() {
    if (this.isProcessing) {
      console.log('⏳ [Firebase Processor] Já está processando notificações...');
      return;
    }

    this.isProcessing = true;
    console.log('🔄 [Firebase Processor] Iniciando processamento de notificações pendentes...');

    try {
      // Buscar notificações não entregues
      const { data: pendingNotifications, error } = await this.supabase
        .from('pending_notifications')
        .select('id, device_token, notification_data, delivery_method, delivery_attempts, created_at')
        .eq('delivered', false)
        .lt('delivery_attempts', this.maxRetries)
        .order('created_at', { ascending: true })
        .limit(this.batchSize);

      if (error) {
        console.error('❌ [Firebase Processor] Erro ao buscar notificações pendentes:', error);
        return;
      }

      if (!pendingNotifications || pendingNotifications.length === 0) {
        console.log('ℹ️ [Firebase Processor] Nenhuma notificação pendente encontrada');
        return;
      }

      console.log(`📊 [Firebase Processor] Encontradas ${pendingNotifications.length} notificações pendentes`);

      // Para cada notificação, buscar o registro do device por device_token
      for (let i = 0; i < pendingNotifications.length; i++) {
        const pn = pendingNotifications[i];
        const { data: deviceRows, error: deviceError } = await this.supabase
          .from('device_registrations')
          .select('fcm_token, is_active, last_seen, platform, is_ios')
          .eq('device_token', pn.device_token)
          .limit(1);

        pn.device_registrations = (deviceError || !deviceRows || deviceRows.length === 0) ? null : deviceRows[0];
      }

      // Processar cada notificação
      const results = await Promise.allSettled(
        pendingNotifications.map(notification => this.processNotification(notification))
      );

      // Contar sucessos e falhas
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      console.log(`✅ [Firebase Processor] Processamento concluído: ${successes} sucessos, ${failures} falhas`);

    } catch (error) {
      console.error('❌ [Firebase Processor] Erro no processamento:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Processar uma notificação individual
  async processNotification(pendingNotification) {
    const { id, device_token, notification_data, device_registrations } = pendingNotification;
    
    try {
      console.log(`🔄 [Firebase Processor] Processando notificação ${id} para device ${device_token}`);

      // Verificar se há token FCM
      const fcmToken = device_registrations?.fcm_token;
      if (!fcmToken) {
        console.warn(`⚠️ [Firebase Processor] Dispositivo ${device_token} não possui token FCM`);
        await this.markAsDelivered(id, false, 'No FCM token');
        return;
      }

      // Preparar dados da notificação
      const notification = {
        title: notification_data.title || 'Nova Notificação',
        body: notification_data.body || '',
        image: notification_data.image
      };

      const data = {
        device_token: device_token,
        notification_id: id.toString(),
        type: notification_data.type || 'general',
        url: notification_data.url || '/',
        ...notification_data.data
      };

      // Enviar via Firebase
      const response = await FirebaseAdminService.sendNotificationToToken(
        fcmToken,
        notification,
        data
      );

      if (response) {
        // Marcar como entregue
        await this.markAsDelivered(id, true);
        console.log(`✅ [Firebase Processor] Notificação ${id} enviada com sucesso`);
      } else {
        throw new Error('Resposta vazia do Firebase');
      }

    } catch (error) {
      console.error(`❌ [Firebase Processor] Erro ao processar notificação ${id}:`, error);
      
      // Incrementar tentativas
      await this.incrementDeliveryAttempts(id, error.message);
      
      throw error;
    }
  }

  // Marcar notificação como entregue
  async markAsDelivered(notificationId, success, errorMessage = null) {
    try {
      const updateData = {
        delivered: success,
        delivered_at: success ? new Date().toISOString() : null,
        last_attempt: new Date().toISOString()
      };

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      const { error } = await this.supabase
        .from('pending_notifications')
        .update(updateData)
        .eq('id', notificationId);

      if (error) {
        console.error(`❌ [Firebase Processor] Erro ao atualizar status da notificação ${notificationId}:`, error);
      }
    } catch (error) {
      console.error(`❌ [Firebase Processor] Erro ao marcar notificação como entregue:`, error);
    }
  }

  // Incrementar tentativas de entrega
  async incrementDeliveryAttempts(notificationId, errorMessage) {
    try {
      const { error } = await this.supabase
        .rpc('increment_delivery_attempts', {
          notification_id: notificationId,
          error_msg: errorMessage
        });

      if (error) {
        console.error(`❌ [Firebase Processor] Erro ao incrementar tentativas:`, error);
      }
    } catch (error) {
      console.error(`❌ [Firebase Processor] Erro ao incrementar tentativas:`, error);
    }
  }

  // Adicionar token FCM ao registro do dispositivo
  async updateDeviceFCMToken(deviceToken, fcmToken) {
    try {
      const { error } = await this.supabase
        .from('device_registrations')
        .update({
          fcm_token: fcmToken,
          updated_at: new Date().toISOString()
        })
        .eq('device_token', deviceToken);

      if (error) {
        console.error('❌ [Firebase Processor] Erro ao atualizar token FCM:', error);
        return false;
      }

      console.log(`✅ [Firebase Processor] Token FCM atualizado para dispositivo ${deviceToken}`);
      return true;
    } catch (error) {
      console.error('❌ [Firebase Processor] Erro ao atualizar token FCM:', error);
      return false;
    }
  }

  // Limpar notificações antigas que excederam o limite de tentativas
  async cleanupFailedNotifications() {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { error } = await this.supabase
        .from('pending_notifications')
        .delete()
        .gte('delivery_attempts', this.maxRetries)
        .lt('created_at', oneWeekAgo.toISOString());

      if (error) {
        console.error('❌ [Firebase Processor] Erro ao limpar notificações antigas:', error);
      } else {
        console.log('🧹 [Firebase Processor] Notificações antigas limpas');
      }
    } catch (error) {
      console.error('❌ [Firebase Processor] Erro na limpeza:', error);
    }
  }

  // Iniciar processamento contínuo
  startContinuousProcessing(intervalMinutes = 5) {
    console.log(`🔄 [Firebase Processor] Iniciando processamento contínuo (${intervalMinutes} minutos)`);
    
    // Processar imediatamente
    this.processPendingNotifications();
    
    // Configurar intervalo
    setInterval(() => {
      this.processPendingNotifications();
    }, intervalMinutes * 60 * 1000);

    // Limpeza diária
    setInterval(() => {
      this.cleanupFailedNotifications();
    }, 24 * 60 * 60 * 1000);
  }
}

export default PendingNotificationsProcessor;