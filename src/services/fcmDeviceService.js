import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Serviço otimizado para gerenciamento de FCM tokens
 * Utiliza as novas funções do banco refatorado
 */
class FCMDeviceService {
  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Busca um dispositivo pelo device_token
   */
  async getDeviceByToken(deviceToken) {
    try {
      const { data, error } = await this.supabase.rpc('get_device_by_token', {
        p_device_token: deviceToken
      });

      if (error) throw error;
      
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Erro ao buscar dispositivo por token:', error.message);
      return null;
    }
  }

  /**
   * Registra ou atualiza um dispositivo com FCM token
   */
  async upsertDevice(deviceData) {
    try {
      const { data, error } = await this.supabase.rpc('upsert_device_registration', {
        p_device_token: deviceData.device_token,
        p_fcm_token: deviceData.fcm_token || null,
        p_user_agent: deviceData.user_agent || null,
        p_platform: deviceData.platform || null,
        p_is_mobile: deviceData.is_mobile || false,
        p_is_ios: deviceData.is_ios || false,
        p_language: deviceData.language || 'pt-BR',
        p_timezone: deviceData.timezone || 'America/Sao_Paulo',
        p_screen_resolution: deviceData.screen_resolution || null,
        p_last_seen_url: deviceData.url || null
      });

      if (error) throw error;
      
      const device = data && data.length > 0 ? data[0] : null;
      
      console.log(`📱 Dispositivo ${device?.was_created ? 'criado' : 'atualizado'}:`, {
        id: device?.id,
        device_token: device?.device_token,
        has_fcm: !!device?.fcm_token
      });

      return device;
    } catch (error) {
      console.error('Erro ao registrar dispositivo:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza apenas o FCM token de um dispositivo
   */
  async updateFCMToken(deviceToken, fcmToken) {
    try {
      const { data, error } = await this.supabase
        .from('device_registrations')
        .update({
          fcm_token: fcmToken,
          fcm_token_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('device_token', deviceToken)
        .select()
        .single();

      if (error) throw error;

      console.log(`🔄 FCM token atualizado para dispositivo ${deviceToken}`);
      return data;
    } catch (error) {
      console.error('Erro ao atualizar FCM token:', error.message);
      throw error;
    }
  }

  /**
   * Busca notificações pendentes que podem ser enviadas via FCM
   */
  async getPendingNotificationsWithFCM() {
    try {
      const { data, error } = await this.supabase.rpc('get_pending_notifications_with_fcm');

      if (error) throw error;
      
      console.log(`📋 Encontradas ${data?.length || 0} notificações com FCM token`);
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar notificações pendentes:', error.message);
      return [];
    }
  }

  /**
   * Marca uma notificação como entregue ou com erro
   */
  async markNotificationDelivered(notificationId, success = true, errorMessage = null) {
    try {
      const { data, error } = await this.supabase.rpc('mark_notification_delivered', {
        p_notification_id: notificationId,
        p_success: success,
        p_error_message: errorMessage
      });

      if (error) throw error;

      console.log(`📤 Notificação ${notificationId} marcada como ${success ? 'entregue' : 'com erro'}`);
      return true;
    } catch (error) {
      console.error('Erro ao marcar notificação:', error.message);
      return false;
    }
  }

  /**
   * Busca estatísticas do sistema FCM
   */
  async getStats() {
    try {
      const { data, error } = await this.supabase.rpc('get_notification_stats');

      if (error) throw error;
      
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error.message);
      return null;
    }
  }

  /**
   * Lista dispositivos ativos com FCM token
   */
  async getActiveDevicesWithFCM() {
    try {
      const { data, error } = await this.supabase
        .from('device_registrations')
        .select('device_token, fcm_token, is_mobile, is_ios, created_at, fcm_token_updated_at')
        .eq('is_active', true)
        .not('fcm_token', 'is', null)
        .order('fcm_token_updated_at', { ascending: false });

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar dispositivos ativos:', error.message);
      return [];
    }
  }

  /**
   * Remove FCM tokens inválidos/expirados
   */
  async cleanupInvalidTokens(invalidTokens = []) {
    if (invalidTokens.length === 0) return 0;

    try {
      const { data, error } = await this.supabase
        .from('device_registrations')
        .update({
          fcm_token: null,
          fcm_token_updated_at: null,
          updated_at: new Date().toISOString()
        })
        .in('fcm_token', invalidTokens)
        .select('device_token');

      if (error) throw error;

      console.log(`🧹 Removidos ${data?.length || 0} FCM tokens inválidos`);
      return data?.length || 0;
    } catch (error) {
      console.error('Erro ao limpar tokens inválidos:', error.message);
      return 0;
    }
  }

  /**
   * Valida se um FCM token está no formato correto
   */
  isValidFCMToken(token) {
    if (!token || typeof token !== 'string') return false;
    
    // FCM tokens são geralmente muito longos e contêm caracteres alfanuméricos
    return token.length > 50 && /^[A-Za-z0-9_:-]+$/.test(token);
  }

  /**
   * Debug: mostra informações detalhadas de um dispositivo
   */
  async debugDevice(deviceToken) {
    try {
      console.log(`\n🔍 Debug do dispositivo: ${deviceToken}`);
      
      const device = await this.getDeviceByToken(deviceToken);
      
      if (!device) {
        console.log('❌ Dispositivo não encontrado');
        return null;
      }

      console.log('📱 Informações do dispositivo:');
      console.log(`   ID: ${device.id}`);
      console.log(`   Device Token: ${device.device_token}`);
      console.log(`   FCM Token: ${device.fcm_token ? device.fcm_token.substring(0, 20) + '...' : 'AUSENTE'}`);
      console.log(`   Ativo: ${device.is_active ? '✅' : '❌'}`);
      console.log(`   Mobile: ${device.is_mobile ? '📱' : '🖥️'}`);
      console.log(`   iOS: ${device.is_ios ? '🍎' : '🤖'}`);
      console.log(`   Criado: ${new Date(device.created_at).toLocaleString()}`);
      console.log(`   FCM Atualizado: ${device.fcm_token_updated_at ? new Date(device.fcm_token_updated_at).toLocaleString() : 'Nunca'}`);

      // Buscar notificações pendentes para este dispositivo
      const { data: pending } = await this.supabase
        .from('pending_notifications')
        .select('*')
        .eq('device_token', deviceToken)
        .eq('delivered', false);

      console.log(`\n📋 Notificações pendentes: ${pending?.length || 0}`);
      
      return device;
    } catch (error) {
      console.error('Erro no debug:', error.message);
      return null;
    }
  }
}

export default new FCMDeviceService();