// Serviço híbrido que integra Firebase com o sistema existente
import FirebaseNotificationService from '../lib/firebase.js';
import { supabase } from '../lib/supabase-safe.js';
import hybridNotificationManager from '../utils/hybridNotificationManager.js';

class HybridFirebaseNotificationService {
  constructor() {
    this.firebaseService = FirebaseNotificationService;
    this.fcmToken = null;
    this.deviceToken = null;
  }

  // Inicializar serviço Firebase
  async initialize() {
    try {
      console.log('🔄 [Hybrid Firebase] Inicializando serviço...');

      // Verificar suporte
      if (!this.firebaseService.isSupported()) {
        console.warn('⚠️ [Hybrid Firebase] Firebase não suportado neste dispositivo');
        return false;
      }

      // Obter token FCM
      this.fcmToken = await this.firebaseService.requestPermissionAndGetToken();

      if (this.fcmToken) {
        console.log('✅ [Hybrid Firebase] Token FCM obtido');

        // Configurar listener de mensagens em primeiro plano
        this.firebaseService.setupForegroundMessageListener((payload) => {
          this.handleForegroundMessage(payload);
        });

        // Garantir que exista um device token (gerar se necessário)
        try {
          let deviceToken = hybridNotificationManager.getStoredDeviceToken();
          if (!deviceToken) {
            deviceToken = await hybridNotificationManager.generateDeviceToken();
          }
          this.deviceToken = deviceToken;

          // Enviar para backend seguro para gravar device + fcm_token
          try {
            const resp = await fetch('/api/register-device', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                device_token: deviceToken,
                fcm_token: this.fcmToken,
                user_agent: navigator.userAgent,
                platform: navigator.platform,
                is_ios: hybridNotificationManager.isIOS,
                is_mobile: hybridNotificationManager.isMobile,
                url: window.location.href
              })
            });

            if (!resp.ok) {
              console.warn('⚠️ [Hybrid Firebase] Backend retornou erro ao registrar device:', resp.status);
            } else {
              console.log('✅ [Hybrid Firebase] fcm_token enviado ao backend para registro do device');
            }
          } catch (err) {
            console.warn('⚠️ [Hybrid Firebase] Erro ao chamar backend /api/register-device:', err);
          }
        } catch (e) {
          console.warn('⚠️ [Hybrid Firebase] Erro ao registrar fcm_token automaticamente:', e);
        }

        return true;
      } else {
        console.warn('⚠️ [Hybrid Firebase] Não foi possível obter token FCM');
        return false;
      }
    } catch (error) {
      console.error('❌ [Hybrid Firebase] Erro na inicialização:', error);
      return false;
    }
  }

  // Registrar dispositivo com token FCM
  async registerDevice(deviceInfo) {
    try {
      console.log('🔄 [Hybrid Firebase] Registrando dispositivo...');

      // Adicionar token FCM aos dados do dispositivo
      const deviceData = {
        ...deviceInfo,
        fcm_token: this.fcmToken,
        updated_at: new Date().toISOString()
      };

      this.deviceToken = deviceInfo.deviceToken;

      // Registrar via backend seguro (/api/register-device)
      try {
        const resp = await fetch('/api/register-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...deviceData, device_token: deviceInfo.deviceToken })
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`register-device failed: ${resp.status} ${text}`);
        }

        const json = await resp.json();
        console.log('✅ [Hybrid Firebase] Dispositivo registrado via backend', json);
        return json.data?.[0] || json.data || null;
      } catch (error) {
        console.error('❌ [Hybrid Firebase] Erro ao registrar dispositivo via backend:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ [Hybrid Firebase] Erro no registro:', error);
      throw error;
    }
  }

  // Atualizar token FCM para dispositivo existente
  async updateFCMToken(deviceToken, fcmToken = null) {
    try {
      const tokenToUse = fcmToken || this.fcmToken;
      
      if (!tokenToUse) {
        console.warn('⚠️ [Hybrid Firebase] Nenhum token FCM disponível');
        return false;
      }

      const { error } = await supabase
        .from('device_registrations')
        .update({
          fcm_token: tokenToUse,
          updated_at: new Date().toISOString()
        })
        .eq('device_token', deviceToken);

      if (error) {
        console.error('❌ [Hybrid Firebase] Erro ao atualizar token FCM:', error);
        return false;
      }

      console.log('✅ [Hybrid Firebase] Token FCM atualizado');
      return true;
    } catch (error) {
      console.error('❌ [Hybrid Firebase] Erro ao atualizar token:', error);
      return false;
    }
  }

  // Enviar notificação (adiciona à fila para processamento)
  async sendNotification(deviceToken, notificationData) {
    try {
      console.log('🔄 [Hybrid Firebase] Adicionando notificação à fila...');

      // Adicionar à tabela de notificações pendentes
      const { data, error } = await supabase
        .from('pending_notifications')
        .insert({
          device_token: deviceToken,
          notification_data: notificationData,
          delivery_method: 'firebase_fcm',
          created_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('❌ [Hybrid Firebase] Erro ao adicionar à fila:', error);
        throw error;
      }

      console.log('✅ [Hybrid Firebase] Notificação adicionada à fila');

      // Tentar envio imediato se o dispositivo está online
      await this.tryImmediateDelivery(deviceToken, notificationData);

      return data?.[0];
    } catch (error) {
      console.error('❌ [Hybrid Firebase] Erro ao enviar notificação:', error);
      throw error;
    }
  }

  // Tentar entrega imediata para dispositivos online
  async tryImmediateDelivery(deviceToken, notificationData) {
    try {
      // Verificar se o dispositivo tem token FCM ativo
      const { data: device, error } = await supabase
        .from('device_registrations')
        .select('fcm_token, is_active, last_seen')
        .eq('device_token', deviceToken)
        .eq('is_active', true)
        .single();

      if (error || !device?.fcm_token) {
        console.log('ℹ️ [Hybrid Firebase] Dispositivo não tem token FCM, será processado em background');
        return false;
      }

      // Verificar se foi visto recentemente (últimos 5 minutos)
      const lastSeen = new Date(device.last_seen);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      if (lastSeen < fiveMinutesAgo) {
        console.log('ℹ️ [Hybrid Firebase] Dispositivo não ativo recentemente, aguardando processamento em background');
        return false;
      }

      console.log('🚀 [Hybrid Firebase] Tentando entrega imediata...');
      
      // Aqui você pode implementar uma chamada à API do Firebase Admin
      // ou deixar para o processador de background
      console.log('ℹ️ [Hybrid Firebase] Entrega imediata delegada ao processador de background');
      
      return true;
    } catch (error) {
      console.error('❌ [Hybrid Firebase] Erro na entrega imediata:', error);
      return false;
    }
  }

  // Handler para mensagens em primeiro plano
  handleForegroundMessage(payload) {
    console.log('📨 [Hybrid Firebase] Mensagem recebida em primeiro plano:', payload);
    
    const { notification, data } = payload;
    
    // Disparar evento customizado para a aplicação
    window.dispatchEvent(new CustomEvent('firebaseNotificationReceived', {
      detail: { notification, data }
    }));

    // Registrar recebimento no banco
    this.logNotificationReceived(data);
    
    // Tocar som personalizado se especificado
    if (data?.sound && data.sound !== 'default') {
      this.playNotificationSound(data.sound);
    }
  }

  // Registrar recebimento de notificação
  async logNotificationReceived(data) {
    try {
      if (data?.notification_id && this.deviceToken) {
        await supabase
          .from('notification_logs')
          .insert({
            device_token: this.deviceToken,
            event_type: 'notification_received_foreground',
            event_data: {
              notification_id: data.notification_id,
              timestamp: new Date().toISOString()
            },
            created_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('❌ [Hybrid Firebase] Erro ao registrar recebimento:', error);
    }
  }

  // Reproduzir som de notificação personalizado
  playNotificationSound(soundName) {
    try {
      const audio = new Audio(`/sounds/${soundName}.mp3`);
      audio.volume = 0.7;
      audio.play().catch(e => {
        console.warn('⚠️ [Hybrid Firebase] Não foi possível reproduzir som:', e);
      });
    } catch (error) {
      console.warn('⚠️ [Hybrid Firebase] Erro ao reproduzir som:', error);
    }
  }

  // Obter estatísticas de notificações
  async getNotificationStats() {
    try {
      const { data, error } = await supabase
        .rpc('get_notification_stats');

      if (error) {
        console.error('❌ [Hybrid Firebase] Erro ao obter estatísticas:', error);
        return null;
      }

      return data?.[0];
    } catch (error) {
      console.error('❌ [Hybrid Firebase] Erro ao obter estatísticas:', error);
      return null;
    }
  }

  // Limpar tokens FCM inválidos
  async cleanupInvalidFCMTokens() {
    try {
      // Esta função seria chamada pelo processador de background
      // quando tokens FCM se tornarem inválidos
      console.log('🧹 [Hybrid Firebase] Limpeza de tokens inválidos delegada ao backend');
    } catch (error) {
      console.error('❌ [Hybrid Firebase] Erro na limpeza:', error);
    }
  }

  // Getter para verificar se está inicializado
  get isInitialized() {
    return !!this.fcmToken;
  }

  // Getter para o token FCM
  get currentFCMToken() {
    return this.fcmToken;
  }
}

export default new HybridFirebaseNotificationService();