// Sistema híbrido de notificações para PWA
// Combina Push API tradicional com estratégias alternativas para iOS

class HybridNotificationManager {
  constructor() {
    this.deviceToken = null
    this.subscriptionData = null
    this.fallbackStrategies = []
    this.isIOS = this.detectIOS()
    this.isMobile = this.detectMobile()
    
    // Inicializar estratégias
    this.initializeStrategies()

    // Heartbeat interval (ms) - enquanto app estiver em foreground envia update no last_seen
    this.heartbeatIntervalMs = 60 * 1000 // 1 minuto
    this.heartbeatTimer = null

    // Listener para mensagens do Service Worker (KEEPALIVE, REQUEST_RESUBSCRIBE etc.)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', async (event) => {
        try {
          const data = event.data
          if (!data || !data.type) return

          if (data.type === 'KEEPALIVE') {
            console.log('[HybridNotification] KEEPALIVE recebido do SW, atualizando last_seen')
            const token = this.getStoredDeviceToken()
            if (token) {
              try {
                const { default: supabasePushService } = await import('../services/supabasePushService.js')
                await supabasePushService.updateLastSeen(token)
              } catch (e) {
                console.warn('[HybridNotification] Erro ao atualizar last_seen via KEEPALIVE:', e)
              }
            }
          }

          if (data.type === 'REQUEST_RESUBSCRIBE') {
            console.log('[HybridNotification] REQUEST_RESUBSCRIBE recebido do SW - re-subscrevendo')
            // Tentar re-registrar subscription
            try {
              this.registerDevice()
            } catch (e) {
              console.warn('[HybridNotification] Falha ao re-registrar após REQUEST_RESUBSCRIBE:', e)
            }
          }
        } catch (e) {
          console.warn('[HybridNotification] Erro no message listener do SW:', e)
        }
      })
    }
  }

  detectIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  // Gerar um device token único baseado em características do dispositivo
  async generateDeviceToken() {
    try {
      // Componentes para criar um token único
      const components = []
      
      // 1. User Agent fingerprint
      components.push(navigator.userAgent)
      
      // 2. Screen resolution
      components.push(`${screen.width}x${screen.height}`)
      
      // 3. Timezone
      components.push(Intl.DateTimeFormat().resolvedOptions().timeZone)
      
      // 4. Language
      components.push(navigator.language)
      
      // 5. Platform
      components.push(navigator.platform)
      
      // 6. Hardware concurrency (número de cores)
      components.push(navigator.hardwareConcurrency || 'unknown')
      
      // 7. Device memory (se disponível)
      components.push(navigator.deviceMemory || 'unknown')
      
      // 8. Connection type (se disponível)
      if (navigator.connection) {
        components.push(navigator.connection.effectiveType || 'unknown')
      }
      
      // 9. Battery level (se disponível)
      if (navigator.getBattery) {
        try {
          const battery = await navigator.getBattery()
          components.push(Math.round(battery.level * 100))
        } catch (e) {
          components.push('battery-unknown')
        }
      }
      
      // 10. Timestamp da primeira visita (localStorage)
      let firstVisit = localStorage.getItem('device_first_visit')
      if (!firstVisit) {
        firstVisit = Date.now().toString()
        localStorage.setItem('device_first_visit', firstVisit)
      }
      components.push(firstVisit)
      
      // Criar hash do device token
      const fingerprint = components.join('|')
      const encoder = new TextEncoder()
      const data = encoder.encode(fingerprint)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      
      // Prefix para identificar como device token
      this.deviceToken = `dt_${hashHex.substring(0, 32)}`
      
      console.log('🔑 [HybridNotification] Device Token gerado:', this.deviceToken)
      
      // Salvar no localStorage para persistência
      localStorage.setItem('device_token', this.deviceToken)
      
      return this.deviceToken
      
    } catch (error) {
      console.error('❌ [HybridNotification] Erro ao gerar device token:', error)
      
      // Fallback: usar timestamp + random
      const fallbackToken = `dt_fallback_${Date.now()}_${Math.random().toString(36).substring(2)}`
      this.deviceToken = fallbackToken
      localStorage.setItem('device_token', fallbackToken)
      
      return fallbackToken
    }
  }

  // Recuperar device token existente
  getStoredDeviceToken() {
    return localStorage.getItem('device_token')
  }

  // Inicializar estratégias baseadas no dispositivo
  initializeStrategies() {
    if (this.isIOS) {
      console.log('📱 [HybridNotification] Dispositivo iOS detectado - usando estratégias otimizadas')
      this.fallbackStrategies = [
        'device_token',      // Token único do dispositivo
        'web_push',          // Push API tradicional
        'local_storage',     // Cache local com polling
        'websocket',         // WebSocket para tempo real
        'server_sent_events' // SSE como fallback
      ]
    } else if (this.isMobile) {
      console.log('📱 [HybridNotification] Dispositivo mobile detectado')
      this.fallbackStrategies = [
        'web_push',          // Push API (funciona melhor no Android)
        'device_token',      // Token como backup
        'websocket',
        'local_storage'
      ]
    } else {
      console.log('💻 [HybridNotification] Desktop detectado')
      this.fallbackStrategies = [
        'web_push',          // Push API funciona bem no desktop
        'websocket',
        'server_sent_events'
      ]
    }
  }

  // Registrar dispositivo usando a melhor estratégia disponível
  async registerDevice() {
    console.log('🔄 [HybridNotification] Iniciando registro híbrido...')
    
    const results = {
      deviceToken: null,
      webPush: null,
      strategies: [],
      errors: []
    }

    // 1. Sempre gerar/recuperar device token
    try {
      let deviceToken = this.getStoredDeviceToken()
      if (!deviceToken) {
        deviceToken = await this.generateDeviceToken()
      } else {
        this.deviceToken = deviceToken
      }
      
      results.deviceToken = deviceToken
      results.strategies.push('device_token')
      console.log('✅ [HybridNotification] Device Token: OK')
      
    } catch (error) {
      console.error('❌ [HybridNotification] Erro no Device Token:', error)
      results.errors.push({ strategy: 'device_token', error: error.message })
    }

    // 2. Tentar Web Push (se suportado e permitido)
    if ('PushManager' in window && 'serviceWorker' in navigator) {
      try {
        const permission = await Notification.requestPermission()
        
        if (permission === 'granted') {
          // Usar VAPID key hardcoded (mais confiável que arquivo)
          const vapidPublicKey = 'BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o'
          
          // Registrar service worker se necessário
          let registration = await navigator.serviceWorker.getRegistration()
          if (!registration) {
            registration = await navigator.serviceWorker.register('/sw.js')
          }
          
          // Criar subscription diretamente
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
          })
          
          if (subscription) {
            results.webPush = subscription
            results.strategies.push('web_push')
            console.log('✅ [HybridNotification] Web Push: OK')
          }
        } else {
          console.log('⚠️ [HybridNotification] Web Push: Permissão negada')
        }
        
      } catch (error) {
        console.error('❌ [HybridNotification] Erro no Web Push:', error)
        results.errors.push({ strategy: 'web_push', error: error.message })
      }
    }

    // 3. Registrar no servidor com todas as informações
    await this.registerOnServer(results)

    return results
  }

  // Converter chave VAPID base64 para Uint8Array
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  // Registrar informações no servidor
  async registerOnServer(registrationData) {
    try {
      // Extrair chaves Web Push da subscription se disponível
      let webPushEndpoint = null
      let webPushP256dh = null
      let webPushAuth = null
      
      if (registrationData.webPush) {
        webPushEndpoint = registrationData.webPush.endpoint
        
        // Tentar extrair chaves de diferentes maneiras
        if (registrationData.webPush.keys) {
          webPushP256dh = registrationData.webPush.keys.p256dh
          webPushAuth = registrationData.webPush.keys.auth
        } else if (registrationData.webPush.getKey) {
          // Converter ArrayBuffer para base64
          try {
            const p256dhBuffer = registrationData.webPush.getKey('p256dh')
            const authBuffer = registrationData.webPush.getKey('auth')
            
            if (p256dhBuffer && authBuffer) {
              webPushP256dh = btoa(String.fromCharCode(...new Uint8Array(p256dhBuffer)))
              webPushAuth = btoa(String.fromCharCode(...new Uint8Array(authBuffer)))
            }
          } catch (keyError) {
            console.warn('[HybridNotification] Erro ao extrair chaves via getKey:', keyError)
          }
        }
        
        console.log('🔍 [HybridNotification] Chaves Web Push extraídas:', {
          endpoint: webPushEndpoint ? 'PRESENTE' : 'AUSENTE',
          p256dh: webPushP256dh ? 'PRESENTE' : 'AUSENTE',
          auth: webPushAuth ? 'PRESENTE' : 'AUSENTE'
        })
      }

      const deviceInfo = {
        deviceToken: this.deviceToken,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        isIOS: this.isIOS,
        isMobile: this.isMobile,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${screen.width}x${screen.height}`,
        strategies: registrationData.strategies,
        webPushSubscription: registrationData.webPush,
        // IMPORTANTE: Salvar chaves Web Push diretamente no device_registrations
        web_push_endpoint: webPushEndpoint,
        web_push_p256dh: webPushP256dh,
        web_push_auth: webPushAuth,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }

      // Tentar obter token FCM automaticamente (se suportado pelo ambiente)
      try {
        if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
          const { FirebaseNotificationService } = await import('../lib/firebase.js');
          if (FirebaseNotificationService && typeof FirebaseNotificationService.requestPermissionAndGetToken === 'function') {
            const fcm = await FirebaseNotificationService.requestPermissionAndGetToken();
            if (fcm) {
              // Enviar de forma segura ao backend para gravar com service_role
              try {
                const resp = await fetch('/api/register-device', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...deviceInfo, device_token: this.deviceToken, fcm_token: fcm })
                });

                if (resp.ok) {
                  console.log('[HybridNotification] FCM token enviado ao backend com sucesso');
                } else {
                  console.warn('[HybridNotification] Backend retornou erro ao gravar fcm_token:', resp.status);
                }
              } catch (netErr) {
                console.warn('[HybridNotification] Falha ao enviar fcm_token ao backend:', netErr);
              }
            } else {
              console.log('[HybridNotification] FCM token não disponível/negado no momento');
            }
          }
        }
      } catch (e) {
        console.warn('[HybridNotification] Falha ao tentar obter FCM token automaticamente:', e);
      }

      console.log('📡 [HybridNotification] Registrando no servidor:', deviceInfo)

      // Importar serviço do Supabase
      const { default: supabasePushService } = await import('../services/supabasePushService.js')
      
      // Usar método específico para device token
      const result = await supabasePushService.registerDeviceToken(deviceInfo)
      
      if (result.success) {
        console.log('✅ [HybridNotification] Registrado no servidor:', result.data?.id)
        localStorage.setItem('registration_id', result.data?.id)
        
        // Log para debug - verificar se as chaves foram salvas
        console.log('🔍 [HybridNotification] Device registration salvo com chaves Web Push:', {
          id: result.data?.id,
          has_web_push_endpoint: !!result.data?.web_push_endpoint,
          has_web_push_p256dh: !!result.data?.web_push_p256dh,
          has_web_push_auth: !!result.data?.web_push_auth
        })
      } else {
        console.error('❌ [HybridNotification] Erro no servidor:', result.error)
      }

      // Se houver subscription Web Push, também registrar na tabela push_subscriptions
      try {
        if (registrationData.webPush && registrationData.webPush.endpoint) {
          console.log('💾 [HybridNotification] Registrando subscription Web Push na tabela push_subscriptions')
          const registrationResult = await supabasePushService.registerSubscription(registrationData.webPush)
          if (registrationResult.success) {
            console.log('✅ [HybridNotification] Subscription salva em push_subscriptions:', registrationResult.data?.id)
          } else {
            console.warn('⚠️ [HybridNotification] Falha ao salvar subscription em push_subscriptions:', registrationResult.error)
          }
        }
      } catch (err) {
        console.error('❌ [HybridNotification] Erro ao tentar registrar subscription no servidor:', err)
      }
      return result

    } catch (error) {
      console.error('❌ [HybridNotification] Erro ao registrar no servidor:', error)
      return { success: false, error: error.message }
    }
  }

  // Iniciar heartbeat para atualizar last_seen periodicamente
  async startHeartbeat() {
    try {
      const token = this.getStoredDeviceToken()
      if (!token) return

      // Limpar timer existente
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)

      // Atualizar imediatamente
      try {
        const { default: supabasePushService } = await import('../services/supabasePushService.js')
        await supabasePushService.updateLastSeen(token)
      } catch (e) {
        console.warn('[HybridNotification] Falha ao atualizar last_seen (imediato):', e)
      }

      // Agendar atualizações periódicas enquanto o app estiver visível
      this.heartbeatTimer = setInterval(async () => {
        if (document.visibilityState === 'visible') {
          try {
            const { default: supabasePushService } = await import('../services/supabasePushService.js')
            await supabasePushService.updateLastSeen(token)
            console.log('[HybridNotification] Heartbeat enviado')
          } catch (e) {
            console.warn('[HybridNotification] Heartbeat falhou:', e)
          }
        }
      }, this.heartbeatIntervalMs)
    } catch (error) {
      console.error('[HybridNotification] Erro ao iniciar heartbeat:', error)
    }
  }

  // Parar heartbeat
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // Configurar listeners de visibilidade para controlar heartbeat
  setupVisibilityListeners() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[HybridNotification] Documento visível - iniciando heartbeat')
        this.startHeartbeat()
      } else {
        console.log('[HybridNotification] Documento oculto - heartbeat pausado')
        // não matar totalmente, mas não fará updates quando oculto
      }
    })
  }

  // Verificar se precisa re-registrar
  async checkRegistrationStatus() {
    const lastRegistration = localStorage.getItem('last_registration')
    const registrationId = localStorage.getItem('registration_id')
    
    // Re-registrar se:
    // 1. Nunca foi registrado
    // 2. Último registro foi há mais de 24 horas
    // 3. Não tem ID de registro
    
    if (!lastRegistration || !registrationId) {
      return { needsRegistration: true, reason: 'never_registered' }
    }
    
    const lastTime = new Date(lastRegistration)
    const now = new Date()
    const hoursSince = (now - lastTime) / (1000 * 60 * 60)
    
    if (hoursSince > 24) {
      return { needsRegistration: true, reason: 'expired' }
    }
    
    return { needsRegistration: false, reason: 'recent' }
  }

  // Método principal para inicializar notificações
  async initialize() {
    console.log('🚀 [HybridNotification] Inicializando sistema híbrido...')
    
    try {
      const status = await this.checkRegistrationStatus()
      
      if (status.needsRegistration) {
        console.log(`🔄 [HybridNotification] Registrando dispositivo (${status.reason})`)
        const result = await this.registerDevice()
        
        // Marcar como registrado
        localStorage.setItem('last_registration', new Date().toISOString())

        // Iniciar heartbeat e listeners de visibilidade
        try {
          this.setupVisibilityListeners()
          this.startHeartbeat()
        } catch (e) {
          console.warn('[HybridNotification] Não foi possível iniciar heartbeat/listeners:', e)
        }
        
        return result
      } else {
        console.log('✅ [HybridNotification] Dispositivo já registrado recentemente')
        
        return {
          deviceToken: this.getStoredDeviceToken(),
          webPush: null,
          strategies: ['cached'],
          errors: []
        }
      }
      
    } catch (error) {
      console.error('❌ [HybridNotification] Erro na inicialização:', error)
      throw error
    }
  }

  // Obter informações do dispositivo atual
  getDeviceInfo() {
    return {
      deviceToken: this.deviceToken || this.getStoredDeviceToken(),
      isIOS: this.isIOS,
      isMobile: this.isMobile,
      strategies: this.fallbackStrategies,
      userAgent: navigator.userAgent,
      registrationId: localStorage.getItem('registration_id')
    }
  }
}

// Exportar instância singleton
export const hybridNotificationManager = new HybridNotificationManager()
export default hybridNotificationManager