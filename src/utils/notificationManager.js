// Utilitários para gerenciamento de notificações

import supabasePushService from '../services/supabasePushService.js'
import iosNotificationHelper from './iosNotificationHelper.js'

export class NotificationManager {
  constructor() {
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
    this.permission = this.isSupported ? Notification.permission : 'denied'
    this.isIOS = this.detectIOS()
  }

  // Detectar se está no iOS
  detectIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  }

  // Verificar se notificações são suportadas
  isNotificationSupported() {
    return this.isSupported
  }

  // Solicitar permissão para notificações
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Notificações não são suportadas neste navegador')
    }

    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      
      // Se for iOS e a permissão foi concedida, configurar suporte específico
      if (this.isIOS && permission === 'granted') {
        console.log('[NotificationManager] Configurando suporte específico para iOS')
      }
      
      return permission
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error)
      throw error
    }
  }

  // Enviar notificação simples
  async sendNotification(title, options = {}) {
    if (this.permission !== 'granted') {
      throw new Error('Permissão para notificações não concedida')
    }

    const defaultOptions = {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      tag: `notification-${Date.now()}`
    }

    const finalOptions = { ...defaultOptions, ...options }

    // Se for iOS, usar o helper específico
    if (this.isIOS) {
      return await iosNotificationHelper.sendNotificationWithFallback(title, finalOptions)
    }

    // Comportamento padrão para outros sistemas
    const notification = new Notification(title, finalOptions)
    
    // Auto-fechar após 5 segundos se não houver interação (exceto iOS)
    if (!this.isIOS) {
      setTimeout(() => {
        notification.close()
      }, 5000)
    }

    return notification
  }

  // Registrar para push notifications com Supabase
  async subscribeToPush() {
    if (!this.isSupported) {
      throw new Error('Push notifications não são suportadas')
    }

    try {
      const registration = await navigator.serviceWorker.ready
      
      // Usar chave VAPID do ambiente
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HI8YN1YrY-YmhS4PQlEr0f5Z5Q8QjC0WQWEj1LYNmEelk7bkVA6qZLQnV8'
      
      const subscriptionOptions = {
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      }

      // Para iOS, adicionar configurações específicas
      if (this.isIOS) {
        console.log('[NotificationManager] Configurando subscription para iOS')
        // iOS requer userVisibleOnly sempre true
        subscriptionOptions.userVisibleOnly = true
      }

      const subscription = await registration.pushManager.subscribe(subscriptionOptions)

      console.log('Subscription criada:', subscription)
      
      // Registrar subscription no Supabase
      await supabasePushService.registerSubscription(subscription)
      
      // Para iOS, configurar monitoramento adicional
      if (this.isIOS) {
        this.setupIOSBackgroundHandling()
      }
      
      return subscription
    } catch (error) {
      console.error('Erro ao se inscrever para push:', error)
      
      // Para iOS, tentar novamente com configurações diferentes
      if (this.isIOS && error.name === 'NotSupportedError') {
        console.log('[NotificationManager] Tentando subscription alternativa para iOS')
        return this.tryAlternativeIOSSubscription()
      }
      
      throw error
    }
  }

  // Configuração específica para iOS em background
  setupIOSBackgroundHandling() {
    if (!this.isIOS) return

    console.log('[NotificationManager] Configurando handling de background para iOS')
    
    // Listener para quando o app vai para background
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // App indo para background
        this.handleIOSBackground()
      } else {
        // App voltando ao foreground
        this.handleIOSForeground()
      }
    })

    // Listener para blur/focus da janela
    window.addEventListener('blur', () => this.handleIOSBackground())
    window.addEventListener('focus', () => this.handleIOSForeground())
  }

  handleIOSBackground() {
    console.log('[NotificationManager] iOS - App indo para background')
    
    // Enviar mensagem para o service worker
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'iOS_APP_BACKGROUND',
        timestamp: Date.now()
      })
    }
  }

  handleIOSForeground() {
    console.log('[NotificationManager] iOS - App voltando ao foreground')
    
    // Verificar notificações perdidas
    setTimeout(() => {
      iosNotificationHelper.checkMissedNotifications()
    }, 1000)
  }

  // Tentar subscription alternativa para iOS
  async tryAlternativeIOSSubscription() {
    try {
      console.log('[NotificationManager] Tentando método alternativo para iOS')
      
      const registration = await navigator.serviceWorker.ready
      
      // Tentar sem applicationServerKey primeiro
      const basicSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true
      })
      
      if (basicSubscription) {
        console.log('[NotificationManager] Subscription básica criada para iOS')
        await supabasePushService.registerSubscription(basicSubscription)
        return basicSubscription
      }
    } catch (error) {
      console.error('[NotificationManager] Erro na subscription alternativa:', error)
      throw error
    }
  }

  // Obter subscription atual
  async getCurrentSubscription() {
    if (!this.isSupported) return null

    try {
      const registration = await navigator.serviceWorker.ready
      return await registration.pushManager.getSubscription()
    } catch (error) {
      console.error('Erro ao obter subscription:', error)
      return null
    }
  }

  // Cancelar subscription do Supabase
  async unsubscribeFromPush() {
    const subscription = await this.getCurrentSubscription()
    if (subscription) {
      // Remover do Supabase
      await supabasePushService.unregisterSubscription(subscription)
      
      // Cancelar localmente
      await subscription.unsubscribe()
      localStorage.removeItem('push-subscription')
      console.log('Subscription cancelada')
    }
  }

  // Converter chave VAPID
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

  // Verificar se já está inscrito
  async isSubscribed() {
    const subscription = await this.getCurrentSubscription()
    return !!subscription
  }

  // Configurações de notificação do usuário
  getUserSettings() {
    const defaultSettings = {
      soundEnabled: true,
      vibrationEnabled: true,
      showBadge: true,
      autoInstall: true
    }

    const saved = localStorage.getItem('notification-settings')
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings
  }

  saveUserSettings(settings) {
    localStorage.setItem('notification-settings', JSON.stringify(settings))
  }
}

// Instância singleton
export const notificationManager = new NotificationManager()

// Hook personalizado para React
export const useNotifications = () => {
  const manager = notificationManager
  
  return {
    isSupported: manager.isSupported,
    permission: manager.permission,
    requestPermission: () => manager.requestPermission(),
    sendNotification: (title, options) => manager.sendNotification(title, options),
    subscribeToPush: () => manager.subscribeToPush(),
    unsubscribeFromPush: () => manager.unsubscribeFromPush(),
    isSubscribed: () => manager.isSubscribed(),
    getUserSettings: () => manager.getUserSettings(),
    saveUserSettings: (settings) => manager.saveUserSettings(settings)
  }
}