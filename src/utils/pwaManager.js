// Utilitários PWA para instalação e modo offline

export class PWAManager {
  constructor() {
    this.deferredPrompt = null
    this.isInstalled = this.checkIfInstalled()
    this.isOnline = navigator.onLine
    
    this.setupEventListeners()
  }

  // Verificar se o app já está instalado
  checkIfInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://')
  }

  // Configurar event listeners
  setupEventListeners() {
    // Listener para prompt de instalação
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      this.deferredPrompt = e
      this.dispatchEvent('installpromptavailable')
    })

    // Listener para quando o app é instalado
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true
      this.deferredPrompt = null
      this.dispatchEvent('appinstalled')
    })

    // Listeners para status online/offline
    window.addEventListener('online', () => {
      this.isOnline = true
      this.dispatchEvent('statuschange', { online: true })
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.dispatchEvent('statuschange', { online: false })
    })
  }

  // Solicitar instalação do PWA
  async promptInstall() {
    if (!this.deferredPrompt) {
      throw new Error('Prompt de instalação não disponível')
    }

    this.deferredPrompt.prompt()
    const result = await this.deferredPrompt.userChoice
    
    this.deferredPrompt = null
    return result.outcome === 'accepted'
  }

  // Verificar se pode mostrar prompt de instalação
  canPromptInstall() {
    return !!this.deferredPrompt && !this.isInstalled
  }

  // Registrar Service Worker
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log('Service Worker registrado:', registration)
        
        // Verificar atualizações
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.dispatchEvent('updateavailable')
            }
          })
        })

        return registration
      } catch (error) {
        console.error('Falha ao registrar Service Worker:', error)
        throw error
      }
    }
  }

  // Atualizar Service Worker
  async updateServiceWorker() {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        registration.update()
      }
    }
  }

  // Obter informações de cache
  async getCacheInfo() {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      const cacheInfos = await Promise.all(
        cacheNames.map(async (name) => {
          const cache = await caches.open(name)
          const keys = await cache.keys()
          return {
            name,
            size: keys.length,
            urls: keys.map(req => req.url)
          }
        })
      )
      return cacheInfos
    }
    return []
  }

  // Limpar cache
  async clearCache() {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      )
      return true
    }
    return false
  }

  // Verificar se está offline
  isOffline() {
    return !this.isOnline
  }

  // Sincronizar dados quando voltar online
  async syncWhenOnline() {
    if (this.isOnline) {
      // Implementar lógica de sincronização
      console.log('Sincronizando dados...')
      
      // Exemplo: enviar notificações pendentes
      const pendingNotifications = this.getPendingNotifications()
      if (pendingNotifications.length > 0) {
        await this.processPendingNotifications(pendingNotifications)
      }
    }
  }

  // Obter notificações pendentes
  getPendingNotifications() {
    const pending = localStorage.getItem('pending-notifications')
    return pending ? JSON.parse(pending) : []
  }

  // Adicionar notificação pendente
  addPendingNotification(notification) {
    const pending = this.getPendingNotifications()
    pending.push({
      ...notification,
      timestamp: Date.now()
    })
    localStorage.setItem('pending-notifications', JSON.stringify(pending))
  }

  // Processar notificações pendentes
  async processPendingNotifications(notifications) {
    try {
      // Simular envio para servidor
      console.log('Processando notificações pendentes:', notifications)
      
      // Limpar notificações pendentes
      localStorage.removeItem('pending-notifications')
      
      return true
    } catch (error) {
      console.error('Erro ao processar notificações pendentes:', error)
      return false
    }
  }

  // Obter estatísticas do PWA
  getStats() {
    return {
      isInstalled: this.isInstalled,
      isOnline: this.isOnline,
      hasServiceWorker: 'serviceWorker' in navigator,
      hasNotifications: 'Notification' in window,
      hasPushManager: 'PushManager' in window,
      canPromptInstall: this.canPromptInstall()
    }
  }

  // Dispatch de eventos customizados
  dispatchEvent(eventName, detail = {}) {
    const event = new CustomEvent(`pwa-${eventName}`, { detail })
    window.dispatchEvent(event)
  }
}

// Instância singleton
export const pwaManager = new PWAManager()

// Hook personalizado para React
export const usePWA = () => {
  const manager = pwaManager
  
  return {
    isInstalled: manager.isInstalled,
    isOnline: manager.isOnline,
    canPromptInstall: manager.canPromptInstall(),
    promptInstall: () => manager.promptInstall(),
    registerServiceWorker: () => manager.registerServiceWorker(),
    updateServiceWorker: () => manager.updateServiceWorker(),
    getCacheInfo: () => manager.getCacheInfo(),
    clearCache: () => manager.clearCache(),
    syncWhenOnline: () => manager.syncWhenOnline(),
    getStats: () => manager.getStats()
  }
}