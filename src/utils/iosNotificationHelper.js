/**
 * Utilitário para melhorar o suporte a notificações no iOS
 * iOS tem limitações específicas para PWAs em background
 */

class iOSNotificationHelper {
  constructor() {
    this.isIOS = this.detectIOS()
    this.notificationQueue = []
    this.lastActivityTime = Date.now()
    this.heartbeatInterval = null
    this.visibilityChangeHandler = this.handleVisibilityChange.bind(this)
    
    if (this.isIOS) {
      this.initIOSSpecificHandling()
    }
  }

  detectIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  }

  initIOSSpecificHandling() {
    console.log('[iOS Helper] Inicializando suporte específico para iOS')
    
    // Monitorar mudanças de visibilidade
    document.addEventListener('visibilitychange', this.visibilityChangeHandler)
    
    // Heartbeat para manter conexão ativa
    this.startHeartbeat()
    
    // Tentar registrar periodic sync (se suportado)
    this.registerPeriodicSync()
    
    // Interceptar notificações quando o app volta ao foreground
    this.setupForegroundNotificationCheck()
  }

  startHeartbeat() {
    // Enviar um ping a cada 25 segundos para manter o SW ativo
    this.heartbeatInterval = setInterval(() => {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'HEARTBEAT',
          timestamp: Date.now()
        })
      }
    }, 25000) // 25 segundos
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      console.log('[iOS Helper] App indo para background')
      this.onAppGoingToBackground()
    } else {
      console.log('[iOS Helper] App voltando ao foreground')
      this.onAppComingToForeground()
    }
  }

  onAppGoingToBackground() {
    this.lastActivityTime = Date.now()
    
    // Tentar manter o service worker ativo por mais tempo
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'APP_GOING_BACKGROUND',
        timestamp: this.lastActivityTime
      })
    }
  }

  onAppComingToForeground() {
    const timeInBackground = Date.now() - this.lastActivityTime
    console.log(`[iOS Helper] App ficou em background por ${timeInBackground}ms`)
    
    // Verificar se existem notificações perdidas
    this.checkMissedNotifications()
    
    // Reiniciar heartbeat se necessário
    if (!this.heartbeatInterval) {
      this.startHeartbeat()
    }
  }

  async checkMissedNotifications() {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        // Solicitar notificações em queue do service worker
        const messageChannel = new MessageChannel()
        
        return new Promise((resolve) => {
          messageChannel.port1.onmessage = (event) => {
            if (event.data.type === 'iOS_QUEUED_NOTIFICATIONS') {
              console.log('[iOS Helper] Notificações em queue encontradas:', event.data.notifications)
              this.handleQueuedNotifications(event.data.notifications)
            }
            resolve()
          }
          
          navigator.serviceWorker.controller.postMessage({
            type: 'CHECK_iOS_NOTIFICATIONS'
          }, [messageChannel.port2])
        })
      }
    } catch (error) {
      console.error('[iOS Helper] Erro ao verificar notificações perdidas:', error)
    }
  }

  handleQueuedNotifications(notifications) {
    // Mostrar notificações que podem ter sido perdidas
    notifications.forEach((notification, index) => {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification(notification.title, {
            ...notification.options,
            tag: `recovery-${notification.options.tag}`
          })
        }
      }, index * 1000) // Espaçar as notificações
    })
  }

  async registerPeriodicSync() {
    try {
      if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready
        await registration.periodicSync.register('ios-notification-check', {
          minInterval: 24 * 60 * 60 * 1000 // 24 horas
        })
        console.log('[iOS Helper] Periodic sync registrado')
      }
    } catch (error) {
      console.log('[iOS Helper] Periodic sync não suportado:', error)
    }
  }

  setupForegroundNotificationCheck() {
    // Verificar notificações quando o app volta ao foco
    window.addEventListener('focus', () => {
      setTimeout(() => {
        this.checkMissedNotifications()
      }, 1000)
    })
  }

  // Método para melhorar a entrega de notificações
  enhanceNotificationDelivery(notificationOptions) {
    if (!this.isIOS) return notificationOptions

    return {
      ...notificationOptions,
      // Forçar interação no iOS
      requireInteraction: true,
      // Manter notificação visível
      silent: false,
      // Permitir re-notificação
      renotify: true,
      // Adicionar vibração se suportado
      vibrate: [200, 100, 200],
      // Adicionar ações para iOS
      actions: notificationOptions.actions || [
        {
          action: 'open',
          title: 'Abrir',
          icon: '/pwa-64x64.png'
        },
        {
          action: 'dismiss',
          title: 'Dispensar'
        }
      ]
    }
  }

  // Método para tentar múltiplas estratégias de entrega
  async sendNotificationWithFallback(title, options) {
    if (!this.isIOS) {
      // Comportamento normal para outros sistemas
      return new Notification(title, options)
    }

    const enhancedOptions = this.enhanceNotificationDelivery(options)
    
    try {
      // Estratégia 1: Notificação padrão
      const notification = new Notification(title, enhancedOptions)
      
      // Estratégia 2: Armazenar na queue local
      this.notificationQueue.push({
        title,
        options: enhancedOptions,
        timestamp: Date.now()
      })
      
      // Estratégia 3: Tentar via service worker também
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'FORCE_NOTIFICATION',
          title,
          options: enhancedOptions
        })
      }
      
      return notification
    } catch (error) {
      console.error('[iOS Helper] Erro ao enviar notificação:', error)
      throw error
    }
  }

  // Limpeza quando não precisar mais
  destroy() {
    this.stopHeartbeat()
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler)
    window.removeEventListener('focus', this.setupForegroundNotificationCheck)
  }
}

// Instância global
const iosNotificationHelper = new iOSNotificationHelper()

export default iosNotificationHelper